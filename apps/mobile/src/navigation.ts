import type { LiveWait } from "@ratecoaster/shared";

export type RootTabs = {
  HomeTab: undefined;
  PlanTab: undefined;
  WaitsTab: undefined;
  ExploreTab: undefined;
  AccountTab: undefined;
};

export type WaitsStack = {
  Waits: undefined;
  Attraction: { attraction: LiveWait };
};

export type ExploreStack = {
  Explore: undefined;
  Hotels: undefined;
  Tickets: undefined;
  Express: undefined;
  Crowds: undefined;
  Guides: undefined;
  Guide: { slug: string };
};
