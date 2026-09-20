// Hardcoded demo links so the app can be tried without needing to find and
// paste a real iRealPro link first. Each is a genuine irealb:// link pulled
// directly from a dedicated song thread on the iReal Pro forums
// (forums.irealpro.com), not synthesized, so they exercise the real-world
// import path including quirks (repeat bars, section endings) that a
// hand-written test fixture would not.
export interface DemoChart {
  label: string;
  link: string;
}

export const DEMO_CHARTS: DemoChart[] = [
  {
    label: 'Autumn Leaves (Kosma)',
    link: 'irealb://Autumn Leaves=Kosma== =Cm=0=1r34LbKcu7ZL7F 7LZ BL7-G 7-G ZL7D b57-A ZL7^bE 7^bZ C-7F 7-C Bb^7 Eb^7LZ A-7b5 D7LZ G-7 G-7LZ== =',
  },
  {
    // From "Black Orpheus - Luiz Bonfa" (forums.irealpro.com/threads/black-orpheus-luiz-bonfa.10859/),
    // the corrected-key Bossa Nova chart posted by forum user melodiousmartin.
    label: 'Black Orpheus (Bonfa)',
    link: 'irealb://Black Orpheus=Bonfa Louis==Bossa Nova=C==1r34LbKcu7ZL7G -XyQ|yX-AZL9b7E 7hBQ|yX-AZL9b7E 7hBQ|D-7A44T[|QyX7Q|C#oX7^F|QyX6C|QyXG7|QyX-DZL9b7A 7yQ|BhyX7^C 7hB|yQ|A-ZL9b7E 7hB|QyXA-ZL9b7E 7hB|QyXA-XyQX9b7EL9b7EZEh7XLC/-D -D|QyXx|yQX-D|QyX9b7A|QyZBh7 L9b7EyX] 9-/GLZhBZLQ  -A|QyX97bE|QyX7hB|QyX^F7 E7bA -AZ-E 7-yQXyQA 7-DZL7-A 7-DQ|yX-A] Q QyXQyX-7LZDXQyXQ7LZA-XyQ|XyQ Z =Jazz-Bossa Nova=140=2===Black Orpheus',
  },
  {
    // From "All Of Me - Gerald Marks-Seymour Simons" (forums.irealpro.com/threads/all-of-me-gerald-marks-seymour-simons.12760/),
    // the "jsb bare bones" chart, chosen as the simplest of several variants posted there.
    label: 'All of Me (Marks/Simons)',
    link: 'irealb://All Of Me - jsb=Marks Gerald==Medium Swing=C==1r34LbKcu7[]  l4CXyQ-DZL lcKQyX7AZ LlcKQyX7EZL lcKXyQKc4TA*[*[]QyyQKclyX7-DZL lcKQyXD7ZL lcKQyX-AZL Q|G7XX7EB*yXFC*Kcl LcKQyX-DZL lcKQXy7AZL lcKQyX7EZl  ][QyXCAQ|F-XyQ|C^7XyQ|A7XyQ|Dh7XyQ|G7XyQ|CXyQ|D-7 G7 Z =Jazz-Medium Swing=160=3',
  },
];

// Kept for backward compatibility with anything referencing a single demo link.
export const DEMO_IREAL_LINK = DEMO_CHARTS[0].link;
