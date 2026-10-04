// A hardcoded demo link so the app can be tried without needing to find
// and paste a real iRealPro link first. It is a genuine irealb:// link
// pulled directly from a dedicated song thread on the iReal Pro forums
// (forums.irealpro.com) rather than synthesized, so it exercises the
// real-world import path including quirks, repeat bars and section endings
// among them, that a hand-written fixture would not.
export interface DemoChart {
  label: string;
  link: string;
}

export const DEMO_CHARTS: DemoChart[] = [
  {
    // From "All Of Me - Gerald Marks-Seymour Simons" (forums.irealpro.com/threads/all-of-me-gerald-marks-seymour-simons.12760/),
    // the "jsb bare bones" chart, chosen as the simplest of several variants posted there.
    label: 'All of Me (Marks/Simons)',
    link: 'irealb://All Of Me - jsb=Marks Gerald==Medium Swing=C==1r34LbKcu7[]  l4CXyQ-DZL lcKQyX7AZ LlcKQyX7EZL lcKXyQKc4TA*[*[]QyyQKclyX7-DZL lcKQyXD7ZL lcKQyX-AZL Q|G7XX7EB*yXFC*Kcl LcKQyX-DZL lcKQXy7AZL lcKQyX7EZl  ][QyXCAQ|F-XyQ|C^7XyQ|A7XyQ|Dh7XyQ|G7XyQ|CXyQ|D-7 G7 Z =Jazz-Medium Swing=160=3',
  },
];
