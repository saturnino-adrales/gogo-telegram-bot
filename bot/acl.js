/**
 * Create an ACL instance. Owner is always allowed and cannot be removed.
 * @param {{ ownerId: number, allowedIds: number[] }} options
 */
export function createAcl({ ownerId, allowedIds }) {
  const allowed = new Set([ownerId, ...allowedIds]);

  return {
    isAllowed(userId) {
      return allowed.has(userId);
    },

    isOwner(userId) {
      return userId === ownerId;
    },

    add(userId) {
      allowed.add(userId);
    },

    remove(userId) {
      if (userId === ownerId) return;
      allowed.delete(userId);
    },

    list() {
      return [...allowed];
    },
  };
}
