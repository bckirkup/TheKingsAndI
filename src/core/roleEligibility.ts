/** ADR 0056: a member may fill either its origin or attained-role chair. */
export function isEligibleForChair<Role extends string>(
  originRole: Role,
  attainedRole: Role | undefined,
  chairRole: Role,
): boolean {
  return originRole === chairRole || attainedRole === chairRole;
}
