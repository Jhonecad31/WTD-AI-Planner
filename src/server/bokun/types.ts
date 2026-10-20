/**
 * Subset of Bokun REST v1 DTOs that the planner reads.
 * Derived from https://api-docs.bokun.dev/rest-v1.yaml (only the fields we use).
 * Everything is optional because Bokun treats absent and null as equal.
 */

export type ProductCategory = "ACCOMMODATION" | "ACTIVITIES" | "CAR_RENTALS" | "TRANSPORT";
export type ActivityBookingType = "PASS" | "DATE" | "DATE_AND_TIME";
/** The spec lists four values, but real data also returns "TRANSPORT". */
export type ActivityType =
  "DAY_TOUR_OR_ACTIVITY" | "MULTI_DAY_TOUR" | "ATTRACTION" | "EVENT" | "TRANSPORT";
export type DurationType = "MINUTES" | "HOURS" | "DAYS";

export interface BokunDerivedPhoto {
  name?: string;
  url?: string;
  cleanUrl?: string;
}

export interface BokunPhoto {
  id?: number;
  originalUrl?: string;
  description?: string;
  alternateText?: string;
  height?: number;
  width?: number;
  derived?: BokunDerivedPhoto[];
}

export interface BokunCategory {
  id?: number;
  title?: string;
  categories?: BokunCategory[];
}

export interface BokunTag {
  id?: number;
  groupId?: number;
  parentTagId?: number;
  title?: string;
  facetName?: string;
}

export interface BokunTagGroup {
  id?: number;
  title?: string;
  tags?: BokunTag[];
}

export interface BokunLocation {
  address?: string;
  city?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  wholeAddress?: string;
}

export interface BokunPricingCategory {
  id?: number;
  title?: string;
  fullTitle?: string;
  ticketCategory?: string;
  occupancy?: number;
  ageQualified?: boolean;
  minAge?: number;
  maxAge?: number;
  dependent?: boolean;
  masterCategoryId?: number;
  internalUseOnly?: boolean;
  defaultCategory?: boolean;
}

export interface BokunStartTime {
  id?: number;
  label?: string;
  hour?: number;
  minute?: number;
  overrideTimeWhenPickup?: boolean;
  pickupHour?: number;
  pickupMinute?: number;
  durationType?: string;
  duration?: number;
  durationMinutes?: number;
  durationHours?: number;
  durationDays?: number;
}

export interface BokunRate {
  id?: number;
  title?: string;
  description?: string;
  rateCode?: string;
  pricedPerPerson?: boolean;
  minPerBooking?: number;
  maxPerBooking?: number;
  startTimeIds?: number[];
  pricingCategoryIds?: number[];
  pickupSelectionType?: string;
  pickupPricingType?: string;
}

export interface BokunPickupPlace {
  id?: number;
  title?: string;
  type?: string;
  location?: BokunLocation;
  askForRoomNumber?: boolean;
}

export interface BokunPlaces {
  pickupPlaces?: BokunPickupPlace[];
  dropoffPlaces?: BokunPickupPlace[];
}

export interface BokunVendor {
  id?: number;
  title?: string;
}

export interface BokunAgendaItem {
  id?: number;
  index?: number;
  title?: string;
  excerpt?: string;
  body?: string;
  day?: number;
}

/** GET /activity.json/{id} */
export interface BokunActivity {
  id: number;
  externalId?: string;
  productCategory?: ProductCategory;
  published?: boolean;
  title?: string;
  description?: string;
  excerpt?: string;
  slug?: string;
  timeZone?: string;
  lastModified?: string;
  keywords?: string[];
  flags?: string[];
  tagGroups?: BokunTagGroup[];
  categories?: BokunCategory[];
  keyPhoto?: BokunPhoto;
  photos?: BokunPhoto[];
  vendor?: BokunVendor;
  reviewRating?: number;
  reviewCount?: number;
  activityType?: ActivityType;
  bookingType?: ActivityBookingType;
  capacityType?: string;
  meetingType?: string;
  privateActivity?: boolean;
  activityCategories?: string[];
  activityAttributes?: string[];
  difficultyLevel?: string;
  durationType?: DurationType;
  duration?: number;
  durationMinutes?: number;
  durationHours?: number;
  durationDays?: number;
  durationText?: string;
  minAge?: number;
  nextDefaultPrice?: number;
  nextDefaultPriceAsText?: string;
  pickupService?: boolean;
  customPickupAllowed?: boolean;
  pickupMinutesBefore?: number;
  dropoffService?: boolean;
  pricingCategories?: BokunPricingCategory[];
  startTimes?: BokunStartTime[];
  rates?: BokunRate[];
  defaultRateId?: number;
  agendaItems?: BokunAgendaItem[];
  included?: string;
  excluded?: string;
  requirements?: string;
  attention?: string;
  knowBeforeYouGoItems?: string[];
  startPoints?: { title?: string; location?: BokunLocation }[];
  bookingCutoffHours?: number;
  bookingCutoffDays?: number;
  comboActivity?: boolean;
  location?: BokunLocation;
  googlePlace?: unknown;
}

export interface BokunMoney {
  amount?: number;
  currency?: string;
}

export interface BokunPriceByItem {
  id?: number;
  amount?: BokunMoney;
}

export interface BokunRatePrices {
  activityRateId?: number;
  pricePerBooking?: BokunMoney;
  pricePerCategoryUnit?: BokunPriceByItem[];
  pickupPrice?: BokunMoney;
  pickupPricePerCategoryUnit?: BokunPriceByItem[];
}

/** GET /activity.json/{id}/availabilities (array) */
export interface BokunAvailability {
  id?: string;
  activityId?: number;
  /** "HH:mm" */
  startTime?: string;
  startTimeId?: number;
  startTimeLabel?: string;
  flexible?: boolean;
  /** epoch ms (UTC midnight of the local date) */
  date?: number;
  /** "yyyy-MM-dd" */
  localizedDate?: string;
  availabilityCount?: number;
  bookedParticipants?: number;
  minParticipants?: number;
  unlimitedAvailability?: boolean;
  defaultRateId?: number;
  rates?: BokunRate[];
  pricesByRate?: BokunRatePrices[];
  defaultPrice?: number;
  /** pricingCategoryId -> amount */
  pricesByCategory?: Record<string, number>;
  pickupPrice?: number;
  pickupPricesByCategory?: Record<string, number>;
  guidedLanguages?: string[];
  unavailable?: boolean;
  soldOut?: boolean;
  pickupSoldOut?: boolean;
}

/** POST /activity.json/search */
export interface BokunSearchResultItem {
  id?: string | number;
  title?: string;
  excerpt?: string;
  summary?: string;
  slug?: string;
  price?: number;
  keyPhoto?: BokunPhoto;
  photos?: BokunPhoto[];
  location?: BokunLocation;
  keywords?: string[];
  flags?: string[];
  vendor?: { id?: number; title?: string };
}

export interface BokunSearchResults {
  items?: BokunSearchResultItem[];
  totalHits?: number;
  tookInMillis?: number;
}

export interface BokunActivityQuery {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  participants?: number;
  participantsByAge?: number[];
  textFilter?: { text?: string; operator?: string };
  facetFilters?: { name?: string; values?: string[] }[];
  sortField?: string;
  sortOrder?: "ASC" | "DESC";
  vendorId?: number;
  excludeBoxes?: boolean;
}
