import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Float "mo:core/Float";
import AccessControl "mo:caffeineai-authorization/access-control";
import Email "mo:caffeineai-email/emailClient";
import Types "../types/price";
import Int "mo:core/Int";
import Order "mo:core/Order";

/// Mixin that exposes per-user ICP portfolio record (icpAmount + investedAmount + priceTargets),
/// user settings, execution history, and alert triggering.
/// All data is scoped to the caller's principal.
mixin (
  accessControlState : AccessControl.AccessControlState,
  portfolioRecords : Map.Map<Principal, Types.PortfolioRecord>,
  userSettings : Map.Map<Principal, Types.UserSettings>,
  executionHistory : Map.Map<Principal, [Types.ExecutionRecord]>,
) {
  let defaultPortfolioRecord : Types.PortfolioRecord = {
    icpAmount = 0.0;
    investedAmount = 0.0;
    priceTargets = [];
  };

  /// Saves the caller's portfolio record (ICP amount, invested USD amount, and price targets).
  /// Rejects anonymous callers. Uses remove+add for guaranteed upsert semantics.
  public shared ({ caller }) func savePortfolioRecord(icpAmount : Float, investedAmount : Float, priceTargets : [Types.PriceTarget]) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous callers cannot save portfolio data");
    };
    portfolioRecords.remove(caller);
    portfolioRecords.add(caller, { icpAmount; investedAmount; priceTargets });
  };

  /// Returns the caller's portfolio record, or a default if not set / anonymous.
  public query ({ caller }) func getPortfolioRecord() : async Types.PortfolioRecord {
    if (caller.isAnonymous()) {
      return defaultPortfolioRecord;
    };
    switch (portfolioRecords.get(caller)) {
      case (?rec) rec;
      case null defaultPortfolioRecord;
    };
  };

  /// Saves the caller's user settings (email, phone, theme, base currency, language, and notification prefs).
  public shared ({ caller }) func saveUserSettings(email : ?Text, phone : ?Text, theme : ?Text, baseCurrency : ?Text, language : ?Text, notifyEmail : ?Bool, notifyPhone : ?Bool) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous callers cannot save user settings");
    };
    // Use remove+add to guarantee upsert semantics: remove any existing entry first,
    // then insert the new value so the caller's settings are always persisted correctly.
    userSettings.remove(caller);
    userSettings.add(caller, { email; phone; theme; baseCurrency; language; notifyEmail; notifyPhone });
  };

  /// Returns the caller's user settings, or defaults if not set / anonymous.
  public query ({ caller }) func getUserSettings() : async Types.UserSettings {
    let defaults : Types.UserSettings = {
      email = null;
      phone = null;
      theme = ?"dark";
      baseCurrency = ?"USD";
      language = ?"en";
      notifyEmail = ?false;
      notifyPhone = ?false;
    };
    if (caller.isAnonymous()) {
      return defaults;
    };
    switch (userSettings.get(caller)) {
      case (?s) {
        {
          s with
          theme = switch (s.theme) { case null ?"dark"; case t t };
          baseCurrency = switch (s.baseCurrency) { case null ?"USD"; case c c };
          language = switch (s.language) { case null ?"en"; case l l };
          notifyEmail = switch (s.notifyEmail) { case null ?false; case v v };
          notifyPhone = switch (s.notifyPhone) { case null ?false; case v v };
        }
      };
      case null defaults;
    };
  };

  /// Removes the caller's portfolio record. No-op if no record exists.
  public shared ({ caller }) func deletePortfolioRecord() : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous callers cannot delete portfolio data");
    };
    portfolioRecords.remove(caller);
  };

  /// Removes the caller's user settings. No-op if no settings exist.
  public shared ({ caller }) func deleteUserSettings() : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous callers cannot delete user settings");
    };
    userSettings.remove(caller);
  };

  /// Sends a test email to the caller's saved email address.
  /// Returns #ok(Text) on success, #err(Text) if no email is saved or the caller is anonymous.
  public shared ({ caller }) func sendTestEmail() : async { #ok : Text; #err : Text } {
    if (caller.isAnonymous()) {
      return #err("You must be logged in to send a test notification");
    };
    let settings = switch (userSettings.get(caller)) {
      case (?s) s;
      case null return #err("No user settings found. Please save your email address in Settings first.");
    };
    let email = switch (settings.email) {
      case (?e) e;
      case null return #err("No email address saved. Please add an email address in Settings first.");
    };
    let subject = "Test Notification - ICP Value Tracker";
    let body = "<p>Hello!</p>" #
      "<p>This is a test notification from your <strong>ICP Value Tracker</strong>.</p>" #
      "<p>Your email notifications are working correctly. You will receive alerts at this address when your ICP price targets are reached.</p>" #
      "<p>Happy investing!</p>" #
      "<p><em>The ICP Value Tracker Team</em></p>";
    let result = await Email.sendServiceEmail("noreply", [email], subject, body);
    switch (result) {
      case (#ok(_)) #ok("Test email sent successfully to " # email);
      case (#err(e)) #err("Failed to send test email: " # e);
    };
  };

  /// Appends an execution record to the caller's history. Rejects anonymous callers.
  public shared ({ caller }) func saveExecutionRecord(record : Types.ExecutionRecord) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous callers cannot save execution records");
    };
    let existing = switch (executionHistory.get(caller)) {
      case (?records) records;
      case null [];
    };
    let updated = existing.concat([record]);
    executionHistory.remove(caller);
    executionHistory.add(caller, updated);
  };

  /// Returns all execution records for the caller, sorted by executedAt descending.
  public query ({ caller }) func getExecutionHistory() : async [Types.ExecutionRecord] {
    if (caller.isAnonymous()) {
      return [];
    };
    switch (executionHistory.get(caller)) {
      case (?records) {
        records.sort(func(a : Types.ExecutionRecord, b : Types.ExecutionRecord) : Order.Order = Int.compare(b.executedAt, a.executedAt))
      };
      case null [];
    };
  };

  /// Checks all stored price targets against currentPrice and fires email alerts
  /// for any un-triggered target where notifyViaEmail or notifyViaPhone is set.
  /// Reads targets from portfolioRecords and writes back updated records on trigger.
  public shared func checkAndTriggerAlerts(currentPrice : Float) : async () {
    for ((principal, record) in portfolioRecords.entries()) {
      let targets = record.priceTargets;
      var updated = false;
      var alertList : [(Text, Float, Float)] = [];
      let settings = switch (userSettings.get(principal)) {
        case (?s) s;
        case null ({
          email = null;
          phone = null;
          theme = ?"dark";
          baseCurrency = ?"USD";
          language = ?"en";
          notifyEmail = ?false;
          notifyPhone = ?false;
        });
      };
      let newTargets : [Types.PriceTarget] = targets.map(
        func(t : Types.PriceTarget) : Types.PriceTarget {
          if (not t.triggered and currentPrice >= t.targetPrice) {
            updated := true;
            if (t.notifyViaEmail) {
              switch (settings.email) {
                case (?email) {
                  alertList := alertList.concat([(email, t.targetPrice, t.tokensToSell)]);
                };
                case null {};
              };
            };
            if (t.notifyViaPhone) {
              switch (settings.email) {
                case (?email) {
                  alertList := alertList.concat([(email, t.targetPrice, t.tokensToSell)]);
                };
                case null {};
              };
            };
            if (not t.notifyViaEmail and not t.notifyViaPhone) {
              switch (t.notifyEmail) {
                case (?email) {
                  alertList := alertList.concat([(email, t.targetPrice, t.tokensToSell)]);
                };
                case null {};
              };
            };
            { t with triggered = true };
          } else {
            t;
          };
        }
      );
      if (updated) {
        portfolioRecords.remove(principal);
        portfolioRecords.add(principal, { record with priceTargets = newTargets });
      };
      for ((email, targetPrice, tokensToSell) in alertList.vals()) {
        let saleValue = tokensToSell * currentPrice;
        let subject = "ICP Price Alert: $" # targetPrice.toText() # " target reached!";
        let body = "<p>Your ICP price target of <strong>$" # targetPrice.toText() #
          "</strong> has been reached.</p>" #
          "<p>Current ICP price: <strong>$" # currentPrice.toText() # "</strong></p>" #
          "<p>You planned to sell <strong>" # tokensToSell.toText() #
          " ICP tokens</strong> (worth <strong>$" # saleValue.toText() # "</strong>).</p>" #
          "<p>Log in to your ICP Value Tracker to review your exit plan.</p>";
        ignore await Email.sendServiceEmail("noreply", [email], subject, body);
      };
    };
  };
};
