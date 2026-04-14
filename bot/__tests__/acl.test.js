import { describe, it, expect } from "vitest";
import { createAcl } from "../acl.js";

describe("createAcl", () => {
  it("allows the owner", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [] });
    expect(acl.isAllowed(111)).toBe(true);
  });

  it("allows users in the ACL list", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [222, 333] });
    expect(acl.isAllowed(222)).toBe(true);
    expect(acl.isAllowed(333)).toBe(true);
  });

  it("rejects unknown users", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [222] });
    expect(acl.isAllowed(999)).toBe(false);
  });

  it("isOwner returns true only for owner", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [222] });
    expect(acl.isOwner(111)).toBe(true);
    expect(acl.isOwner(222)).toBe(false);
  });

  it("add() adds a user at runtime", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [] });
    expect(acl.isAllowed(555)).toBe(false);
    acl.add(555);
    expect(acl.isAllowed(555)).toBe(true);
  });

  it("remove() removes a user at runtime", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [222] });
    expect(acl.isAllowed(222)).toBe(true);
    acl.remove(222);
    expect(acl.isAllowed(222)).toBe(false);
  });

  it("cannot remove the owner", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [] });
    acl.remove(111);
    expect(acl.isAllowed(111)).toBe(true);
  });

  it("list() returns all allowed user IDs", () => {
    const acl = createAcl({ ownerId: 111, allowedIds: [222, 333] });
    expect(acl.list()).toEqual([111, 222, 333]);
  });
});
