import { vi } from "vitest";

export const members = [
  {
    id: null,
    userId: 1,
    name: "Ana",
    email: "ana@example.com",
    role: "owner",
    status: "active",
    participatesInReview: true,
  },
  {
    id: 4,
    userId: 2,
    name: "Bruno",
    email: "bruno@example.com",
    role: "reviewer",
    status: "active",
    participatesInReview: true,
  },
];
export function collaboration(overrides = {}) {
  return {
    members,
    invitations: [
      {
        id: 3,
        emailNormalized: "bia@example.com",
        role: "reviewer",
        participatesInReview: true,
        status: "pending",
      },
    ],
    assignments: [],
    conflicts: [],
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    capabilities: [
      "manage_members",
      "manage_distribution",
      "transfer_ownership",
      "resolve_conflicts",
      "edit_project",
    ],
    ...Object.fromEntries(
      [
        "createInvitation",
        "updateInvitation",
        "cancelInvitation",
        "updateMember",
        "removeMember",
        "transferOwnership",
        "previewAssignments",
        "distributeAssignments",
        "previewAdaptation",
        "adaptAssignments",
        "reassignAssignment",
        "resolveConflict",
        "markNotificationRead",
        "markAllNotificationsRead",
        "refreshNotifications",
      ].map((name) => [name, vi.fn().mockResolvedValue({})]),
    ),
    ...overrides,
  };
}
