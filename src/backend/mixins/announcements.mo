import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Order "mo:core/Order";
import AccessControl "mo:caffeineai-authorization/access-control";
import Types "../types/price";

/// Mixin that provides admin-managed system-wide announcements.
/// Admin access is enforced on all write operations.
mixin (
  accessControlState : AccessControl.AccessControlState,
  announcements : Map.Map<Nat, Types.Announcement>,
  announcementState : { var nextId : Nat },
) {
  /// Creates a new announcement. Caller must have the #admin role.
  public shared ({ caller }) func createAnnouncement(
    title : Text,
    body : Text,
    announcementType : Types.AnnouncementType,
  ) : async Nat {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: admin access required");
    };
    let id = announcementState.nextId;
    announcementState.nextId += 1;
    let now = Time.now();
    announcements.add(id, {
      id;
      title;
      body;
      announcementType;
      isPublished = false;
      createdAt = now;
      updatedAt = now;
    });
    id;
  };

  /// Updates an existing announcement. Caller must have the #admin role.
  public shared ({ caller }) func updateAnnouncement(
    id : Nat,
    title : Text,
    body : Text,
    announcementType : Types.AnnouncementType,
  ) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: admin access required");
    };
    switch (announcements.get(id)) {
      case null false;
      case (?existing) {
        announcements.add(id, {
          existing with
          title;
          body;
          announcementType;
          updatedAt = Time.now();
        });
        true;
      };
    };
  };

  /// Deletes an announcement by id. Caller must have the #admin role.
  public shared ({ caller }) func deleteAnnouncement(id : Nat) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: admin access required");
    };
    switch (announcements.get(id)) {
      case null false;
      case (?_) {
        announcements.remove(id);
        true;
      };
    };
  };

  /// Toggles the isPublished flag of an announcement. Caller must have the #admin role.
  public shared ({ caller }) func toggleAnnouncementPublished(id : Nat) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: admin access required");
    };
    switch (announcements.get(id)) {
      case null false;
      case (?existing) {
        announcements.add(id, {
          existing with
          isPublished = not existing.isPublished;
          updatedAt = Time.now();
        });
        true;
      };
    };
  };

  /// Returns all announcements, newest first. Caller must have the #admin role.
  public shared query ({ caller }) func getAllAnnouncements() : async [Types.Announcement] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: admin access required");
    };
    let all = announcements.values().toArray();
    all.sort(func(a : Types.Announcement, b : Types.Announcement) : Order.Order =
      Int.compare(b.createdAt, a.createdAt)
    );
  };

  /// Returns only published announcements, newest first.
  /// Any authenticated (non-anonymous) caller may call this.
  public shared query ({ caller }) func getPublishedAnnouncements() : async [Types.Announcement] {
    ignore caller; // authenticated-only; anonymous users simply get an empty list
    let published = announcements.values()
      .filter(func(a : Types.Announcement) : Bool { a.isPublished })
      .toArray();
    published.sort(func(a : Types.Announcement, b : Types.Announcement) : Order.Order =
      Int.compare(b.createdAt, a.createdAt)
    );
  };
};
