export interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

const DEFAULT_STICKY_SCROLL_THRESHOLD_PX = 40;

export function getScrollDistanceFromBottom(position: ScrollPosition): number {
  return position.scrollHeight - position.scrollTop - position.clientHeight;
}

export function isScrollNearBottom(
  position: ScrollPosition,
  thresholdPx = DEFAULT_STICKY_SCROLL_THRESHOLD_PX,
): boolean {
  return getScrollDistanceFromBottom(position) <= thresholdPx;
}
