import List "mo:core/List";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Int "mo:core/Int";
import Types "../types/price";

/// Mixin that exposes the ICP Community Chat public API.
/// State is owned by main.mo and injected here so it survives upgrades.
mixin (
  chatMessages : List.List<Types.ChatMessage>,
  chatState : { var nextId : Nat },
) {

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Computes the tab classification for a message based on reaction counts.
  /// Returns "shills" if shills > likes, "fud" if fuds > likes (fud wins ties), else "icp".
  func computeTab(m : Types.ChatMessage) : Text {
    let likeCount  = m.likes.size();
    let shillCount = m.shills.size();
    let fudCount   = m.fuds.size();
    if (fudCount > likeCount) "fud"
    else if (shillCount > likeCount) "shills"
    else "icp";
  };

  /// Returns the message with its `tab` field recomputed from current reaction counts.
  func withTab(m : Types.ChatMessage) : Types.ChatMessage {
    { m with tab = computeTab(m) };
  };

  /// Converts a ChatMessage to a public-safe representation (recomputes tab).
  func toPublicMsg(m : Types.ChatMessage) : Types.ChatMessage { withTab(m) };

  /// Finds a message by id. Returns ?ChatMessage.
  func findMsg(id : Nat) : ?Types.ChatMessage {
    chatMessages.find(func(m : Types.ChatMessage) : Bool { m.id == id });
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Posts a new message to the community chat.
  /// Rejects anonymous callers and empty / overly-long content.
  public shared ({ caller }) func postChatMessage(
    content : Text,
    imageKey : ?Text,
    replyToId : ?Nat,
    urlPreview : ?Types.UrlPreview,
  ) : async { #ok : Types.ChatMessage; #err : Text } {
    if (caller.isAnonymous()) {
      return #err("You must be logged in to post a message");
    };
    let trimmed = content;
    if (trimmed.size() == 0) {
      return #err("Message content cannot be empty");
    };
    if (trimmed.size() > 1000) {
      return #err("Message content must be 1000 characters or fewer");
    };
    let principalText = caller.toText();
    let authorName = if (principalText.size() <= 8) principalText
                     else {
                       let chars = principalText.toArray();
                       var s = "";
                       var i = 0;
                       while (i < 8) { s #= chars[i].toText(); i += 1 };
                       s;
                     };
    let id = chatState.nextId;
    chatState.nextId += 1;
    let msg : Types.ChatMessage = {
      id;
      authorPrincipal = caller;
      authorName;
      content = trimmed;
      imageKey;
      likes = [];
      dislikes = [];
      shills = [];
      fuds = [];
      replyToId;
      timestamp = Time.now();
      isDeleted = false;
      tab = "icp";
      urlPreview;
    };
    chatMessages.add(msg);
    #ok(toPublicMsg(msg));
  };

  /// Returns non-deleted messages sorted newest-first with pagination.
  public query func getChatMessages(
    limit : Nat,
    offset : Nat,
  ) : async [Types.ChatMessage] {
    // Collect all non-deleted messages.
    let all = Array.tabulate(
      chatMessages.size(),
      func(i) { chatMessages.at(i) },
    );
    let nonDeleted = all.filter(func(m : Types.ChatMessage) : Bool { not m.isDeleted });
    // Sort newest-first.
    let sorted = nonDeleted.sort(func(a : Types.ChatMessage, b : Types.ChatMessage) : { #less; #equal; #greater } {
      Int.compare(b.timestamp, a.timestamp);
    });
    let total = sorted.size();
    if (offset >= total) return [];
    let safeLimit = if (limit == 0 or limit > 100) 50 else limit;
    let end = if (offset + safeLimit > total) total else offset + safeLimit;
    // Recompute tab for each message at read time so it reflects current reaction counts.
    Array.tabulate<Types.ChatMessage>(end - offset, func(i) { withTab(sorted[offset + i]) });
  };

  /// Toggles a like or dislike on a message.
  /// Like and dislike lists are mutually exclusive — toggling one removes the other.
  public shared ({ caller }) func toggleChatLike(
    messageId : Nat,
    isLike : Bool,
  ) : async { #ok : Types.ChatMessage; #err : Text } {
    if (caller.isAnonymous()) {
      return #err("You must be logged in to react to messages");
    };
    switch (findMsg(messageId)) {
      case null return #err("Message not found");
      case (?m) {
            if (m.isDeleted) return #err("Cannot react to a deleted message");
            let callerInLikes    = m.likes.find(func(p : Principal) : Bool { p == caller }) != null;
            let callerInDislikes = m.dislikes.find(func(p : Principal) : Bool { p == caller }) != null;
            let newLikes : [Principal] = if (isLike) {
              if (callerInLikes) {
                // Toggle off
                m.likes.filter(func(p : Principal) : Bool { p != caller });
              } else {
                m.likes.concat([caller]);
              };
            } else {
              // Removing from likes when switching to dislike
              if (callerInLikes) m.likes.filter(func(p : Principal) : Bool { p != caller })
              else m.likes;
            };
            let newDislikes : [Principal] = if (not isLike) {
              if (callerInDislikes) {
                // Toggle off
                m.dislikes.filter(func(p : Principal) : Bool { p != caller });
              } else {
                m.dislikes.concat([caller]);
              };
            } else {
              // Removing from dislikes when switching to like
              if (callerInDislikes) m.dislikes.filter(func(p : Principal) : Bool { p != caller })
              else m.dislikes;
            };
            let updated : Types.ChatMessage = {
              m with
              likes = newLikes;
              dislikes = newDislikes;
            };
            chatMessages.mapInPlace(func(msg : Types.ChatMessage) : Types.ChatMessage {
              if (msg.id == messageId) updated else msg;
            });
            #ok(toPublicMsg(updated));
      };
    };
  };

  /// Toggles a Shill or FUD reaction on a message.
  /// Shill and FUD are mutually exclusive with each other but independent of likes/dislikes.
  /// - isShill=true: add caller to shills (remove from fuds if present).
  /// - isShill=false: add caller to fuds (remove from shills if present).
  /// Toggling the same reaction a second time removes it (toggle-off).
  public shared ({ caller }) func toggleChatShill(
    messageId : Nat,
    isShill : Bool,
  ) : async { #ok : Types.ChatMessage; #err : Text } {
    if (caller.isAnonymous()) {
      return #err("You must be logged in to react to messages");
    };
    switch (findMsg(messageId)) {
      case null return #err("Message not found");
      case (?m) {
            if (m.isDeleted) return #err("Cannot react to a deleted message");
            let inShills = m.shills.find(func(p : Principal) : Bool { p == caller }) != null;
            let inFuds   = m.fuds.find(func(p : Principal) : Bool { p == caller }) != null;
            let newShills : [Principal] = if (isShill) {
              if (inShills) m.shills.filter(func(p : Principal) : Bool { p != caller }) // toggle off
              else m.shills.concat([caller]);
            } else {
              // switching to FUD — remove from shills
              if (inShills) m.shills.filter(func(p : Principal) : Bool { p != caller })
              else m.shills;
            };
            let newFuds : [Principal] = if (not isShill) {
              if (inFuds) m.fuds.filter(func(p : Principal) : Bool { p != caller }) // toggle off
              else m.fuds.concat([caller]);
            } else {
              // switching to Shill — remove from fuds
              if (inFuds) m.fuds.filter(func(p : Principal) : Bool { p != caller })
              else m.fuds;
            };
            let updated : Types.ChatMessage = withTab({ m with shills = newShills; fuds = newFuds });
            chatMessages.mapInPlace(func(msg : Types.ChatMessage) : Types.ChatMessage {
              if (msg.id == messageId) updated else msg;
            });
            #ok(updated);
      };
    };
  };

  /// Soft-deletes a message. Only the author or an admin can delete.
  public shared ({ caller }) func deleteChatMessage(
    messageId : Nat,
  ) : async { #ok; #err : Text } {
    if (caller.isAnonymous()) {
      return #err("You must be logged in to delete messages");
    };
    switch (findMsg(messageId)) {
      case null return #err("Message not found");
      case (?m) {
            let isAuthor = m.authorPrincipal == caller;
            let isAdmin  = caller.isController();
            if (not isAuthor and not isAdmin) {
              return #err("You are not allowed to delete this message");
            };
            chatMessages.mapInPlace(func(msg : Types.ChatMessage) : Types.ChatMessage {
              if (msg.id == messageId) { { msg with isDeleted = true } } else { msg };
            });
            #ok;
      };
    };
  };
};
