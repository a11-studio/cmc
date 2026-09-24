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

const MY_TRADING_NAV = {
  href: "/my-trading",
  label: "My Trading",
  match: "my-trading" as const,
  iconSrc: "/nav/user.svg",
};

export type PrimaryNavItem =
  | (typeof PRIMARY_NAV)[number]
  | {
      href: string;
      label: string;
      match: "my-trading";
      iconSrc: string;
    };

export function primaryNavForAudience(
  debugControls: boolean,
  humanTrader = false
): PrimaryNavItem[] {
  const base = debugControls
    ? [...PRIMARY_NAV]
    : PRIMARY_NAV.filter((item) => item.match !== "settings");

  if (!humanTrader) {
    return base;
  }

  if (debugControls) {
    const settings = base.find((item) => item.match === "settings");
    const rest = base.filter((item) => item.match !== "settings");
    return [...rest, MY_TRADING_NAV, ...(settings ? [settings] : [])];
  }

  return [...base, MY_TRADING_NAV];
}

export function isActiveNavPath(pathname: string, match: PrimaryNavItem["match"]) {
  if (match === "home") {
    return pathname === "/";
  }

  return pathname === `/${match}` || pathname.startsWith(`/${match}/`);
}
