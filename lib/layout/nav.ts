export const PRIMARY_NAV = [
  {
    href: "/",
    label: "Home",
    match: "home",
    iconSrc: "/nav/home.svg",
  },
  {
    href: "/research",
    label: "Research",
    match: "research",
    iconSrc: "/nav/research.svg",
  },
  {
    href: "/activity",
    label: "Activities",
    match: "activity",
    iconSrc: "/nav/activity.svg",
  },
  {
    href: "/winners",
    label: "Winners",
    match: "winners",
    iconSrc: "/nav/winners.svg",
  },
  {
    href: "/chat",
    label: "Chat",
    match: "chat",
    iconSrc: "/nav/chat.svg",
  },
  {
    href: "/settings",
    label: "Settings",
    match: "settings",
    iconSrc: "/nav/settings.svg",
  },
] as const;

export type PrimaryNavItem = (typeof PRIMARY_NAV)[number];

export function primaryNavForAudience(debugControls: boolean): PrimaryNavItem[] {
  if (debugControls) {
    return [...PRIMARY_NAV];
  }

  return PRIMARY_NAV.filter((item) => item.match !== "settings");
}

export function isActiveNavPath(pathname: string, match: PrimaryNavItem["match"]) {
  if (match === "home") {
    return pathname === "/";
  }

  return pathname === `/${match}` || pathname.startsWith(`/${match}/`);
}
