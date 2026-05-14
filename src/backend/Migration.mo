import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  // ── Old types (from the previously deployed actor) ──────────────────────

  type OldUserSettings = {
    email : ?Text;
    phone : ?Text;
    theme : ?Text;
    baseCurrency : ?Text;
    language : ?Text;
  };

  type OldPriceTarget = {
    id : Text;
    targetPrice : Float;
    tokensToSell : Float;
    icpAmount : Float;
    notifyEmail : ?Text;
    notifyViaEmail : Bool;
    notifyViaPhone : Bool;
    triggered : Bool;
  };

  type OldPortfolioRecord = {
    icpAmount : Float;
    investedAmount : Float;
    priceTargets : [OldPriceTarget];
  };

  type OldActor = {
    portfolioRecords : Map.Map<Principal, OldPortfolioRecord>;
    userSettings : Map.Map<Principal, OldUserSettings>;
  };

  // ── New types (matching the current actor shape) ─────────────────────────

  type PriceTarget = {
    id : Text;
    targetPrice : Float;
    tokensToSell : Float;
    icpAmount : Float;
    notifyEmail : ?Text;
    notifyViaEmail : Bool;
    notifyViaPhone : Bool;
    triggered : Bool;
  };

  type PortfolioRecord = {
    icpAmount : Float;
    investedAmount : Float;
    priceTargets : [PriceTarget];
  };

  type UserSettings = {
    email : ?Text;
    phone : ?Text;
    theme : ?Text;
    baseCurrency : ?Text;
    language : ?Text;
    notifyEmail : ?Bool;
    notifyPhone : ?Bool;
  };

  type NewActor = {
    portfolioRecords : Map.Map<Principal, PortfolioRecord>;
    userSettings : Map.Map<Principal, UserSettings>;
  };

  public func run(old : OldActor) : NewActor {
    // portfolioRecords: shape is identical between old and new — pass through as-is.
    let portfolioRecords = old.portfolioRecords;

    // userSettings: add the two new optional notification fields defaulting to null.
    let userSettings = old.userSettings.map<Principal, OldUserSettings, UserSettings>(
      func(_, s) {
        { s with notifyEmail = null; notifyPhone = null }
      }
    );

    { portfolioRecords; userSettings };
  };
};
