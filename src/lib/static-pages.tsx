import type { LucideIcon } from "lucide-react";
import {
  ChartBarIcon,
  BadgeHelpIcon,
  ChurchIcon,
  ContactRoundIcon,
  DownloadIcon,
  GiftIcon,
  HeartHandshakeIcon,
  HouseIcon,
  LibraryBigIcon,
  ScrollTextIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";

import type { StaticPageId } from "@/types/reader";
import { TIMELINE_WEBSITE_CREDITS } from "@/data/timeline-source-credits";

export type StaticPageDefinition = {
  id: StaticPageId;
  title: string;
  menuLabel: string;
  icon: LucideIcon;
  content: {
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    links?: Array<{
      label: string;
      href?: string;
      description: string;
    }>;
  };
};

export const STATIC_PAGES: StaticPageDefinition[] = [
  {
    id: "settings",
    title: "Settings",
    menuLabel: "Settings",
    icon: SettingsIcon,
    content: {
      eyebrow: "Preferences",
      heading: "Settings",
      paragraphs: [
        "Reader preferences for this device.",
      ],
    },
  },
  {
    id: "progress",
    title: "Reading Progress",
    menuLabel: "Reading Progress",
    icon: ChartBarIcon,
    content: {
      eyebrow: "Reading",
      heading: "Reading Progress",
      paragraphs: [
        "Track chapter completion across the whole Bible.",
      ],
    },
  },
  {
    id: "welcome-home",
    title: "Welcome Home",
    menuLabel: "Welcome Home",
    icon: HouseIcon,
    content: {
      eyebrow: "Start Here",
      heading: "Welcome Home",
      paragraphs: [],
    },
  },
  {
    id: "saved",
    title: "How to Get Saved",
    menuLabel: "How to Get Saved",
    icon: HeartHandshakeIcon,
    content: {
      eyebrow: "Gospel",
      heading: "How to Get Saved",
      paragraphs: [
        "This page is reserved for a clear presentation of the gospel, salvation by grace through faith, and supporting Scripture references.",
        "It should eventually include a concise explanation, a longer study path, and direct links into relevant passages for follow-up reading.",
      ],
    },
  },
  {
    id: "kjv-only",
    title: "Why KJV Only?",
    menuLabel: "Why KJV Only?",
    icon: ScrollTextIcon,
    content: {
      eyebrow: "Doctrine",
      heading: "Why KJV Only?",
      paragraphs: [
        "This page is intended for the doctrinal and historical case for the King James Bible, including manuscript issues, translation philosophy, and common objections.",
        "It should eventually organize source material into a readable structure with citations, comparisons, and study references.",
      ],
    },
  },
  {
    id: "resources",
    title: "Resources",
    menuLabel: "Resources",
    icon: LibraryBigIcon,
    content: {
      eyebrow: "Library",
      heading: "Resources",
      paragraphs: [
        "This page will gather supporting study tools, downloadable materials, trusted external references, and recommended reading.",
        "It can later be broken into categories such as Bible study, doctrine, ministry helps, and evangelism.",
      ],
    },
  },
  {
    id: "churches",
    title: "Local Churches",
    menuLabel: "Local Churches",
    icon: ChurchIcon,
    content: {
      eyebrow: "Fellowship",
      heading: "Local Churches",
      paragraphs: [
        "These external church directories can help you begin looking for KJV-only, Bible-believing, or independent Baptist churches.",
        "Always verify doctrine, gospel clarity, and local reputation for yourself before attending or recommending a church.",
      ],
      links: [
        {
          label: "Fundamental.org KJV Church Directory",
          href: "https://fundamental.org/kjv-church-directory/",
          description:
            "A directory of KJV churches from a long-running fundamental Baptist resource site.",
        },
        {
          label: "KJVChurches.com",
          href: "https://www.kjvchurches.com/churches/tags/kjv-only/",
          description:
            "A directory focused on KJV-only church listings and tag-based browsing.",
        },
        {
          label: "Real Bible Believers Church Finder",
          href: "https://realbiblebelievers.com/bible-believing-church",
          description:
            "A church-finder page connected to the Real Bible Believers ministry.",
        },
        {
          label: "IndependentBaptist.Church",
          href: "https://independentbaptist.church/",
          description:
            "An independent Baptist church directory for location-based browsing.",
        },
      ],
    },
  },
  {
    id: "download",
    title: "Download",
    menuLabel: "Download",
    icon: DownloadIcon,
    content: {
      eyebrow: "Offline Access",
      heading: "Download",
      paragraphs: [
        "This page will centralize downloadable app packages, data bundles, audio sets, and supporting study materials.",
        "It should later distinguish by platform and provide versioned release notes or checksums.",
      ],
    },
  },
  {
    id: "donate",
    title: "Donate",
    menuLabel: "Donate",
    icon: GiftIcon,
    content: {
      eyebrow: "Support",
      heading: "Donate",
      paragraphs: [
        "This page is reserved for donation information, financial transparency, and the practical needs the project is supporting.",
        "It should later include clear methods, accountability notes, and any legal or tax information that applies.",
      ],
    },
  },
  {
    id: "credits",
    title: "Credits",
    menuLabel: "Credits",
    icon: SparklesIcon,
    content: {
      eyebrow: "Acknowledgements",
      heading: "Credits",
      paragraphs: [
        "This project uses Bible text, reference data, dictionaries, maps, genealogy data, and open-source libraries that each deserve clear attribution.",
        "Additional attribution, licenses, and source links should continue to be documented here as data sources are added or updated.",
        "Timeline sources are grouped by website below. The KJV remains primary; external chronology supplies provisional calendar comparisons.",
      ],
      links: [
        {
          label: "The SWORD Project",
          href: "https://www.crosswire.org/sword/modules/index.jsp",
          description:
            "Bible text, Strong's dictionaries, and Hitchcock's Bible Names.",
        },
        {
          label: "OpenBible.info",
          href: "https://www.openbible.info/geo/",
          description:
            "Place, topic, cross-reference, and Bible reference-parser data. Quiz map points are adapted under CC BY 4.0; coast shapes are schematic.",
        },
        {
          label: "Crossway",
          href: "https://www.esv.org/resources/esv-global-study-bible/table-of-weights-and-measures/",
          description: "Approximate modern weights and measures for quiz explanations; the KJV remains the source text.",
        },
        {
          label: "American Bible Society",
          href: "https://www.americanbible.org/engage/bible-resources/articles/weights-and-measures-in-ancient-israel/",
          description: "Historical measurement estimates and variation, including the New Testament stadion represented as furlong in the KJV.",
        },
        {
          label: "Complete Bible Genealogy",
          href: "https://www.complete-bible-genealogy.com/",
          description:
            "People, family relationships, and verse references.",
        },
        {
          label: "Northside Baptist Church",
          href: "https://www.northsidebaptistchurch.org.au/kjv-dictionary/",
          description:
            "Scott Childs's KJV archaic-word dictionary.",
        },
        {
          label: "PreservedWords.com",
          href: "https://www.preservedwords.com/wordlist.txt",
          description:
            "Supplemental KJV word and phrase definitions.",
        },
        {
          label: "The Bible Word-Book",
          href: "https://archive.org/details/biblewordbookglo00wrigiala",
          description:
            "William Aldis Wright's public-domain Bible Word-Book.",
        },
        {
          label: "3Bible.com Audio Bible",
          href: "https://3bible.com/AudioBible.php",
          description:
            "Audio Bible narrated by Stephen Johnston.",
        },
        {
          label: "Webster's 1828 Dictionary",
          href: "https://github.com/CrossCrusaders/Websters1828API",
          description:
            "Webster's 1828 dictionary data.",
        },
        {
          label: "OverviewBible Free Bible Icons",
          href: "https://overviewbible.com/free-bible-icons/",
          description:
            "Bible book icons.",
        },
        {
          label: "Biblical Units",
          description:
            "Project-curated biblical measures; no single upstream source.",
        },
        ...TIMELINE_WEBSITE_CREDITS,
      ],
    },
  },
  {
    id: "contact",
    title: "Contact",
    menuLabel: "Contact",
    icon: ContactRoundIcon,
    content: {
      eyebrow: "Communication",
      heading: "Contact",
      paragraphs: [
        "Questions, feedback, issues, and other communication for this project should go through the GitHub repository.",
      ],
      links: [
        {
          label: "KJV Only on GitHub",
          href: "https://github.com/gcoxdev/KJV-Only",
          description:
            "Use the repository for issues, discussion, feedback, and project updates.",
        },
      ],
    },
  },
  {
    id: "help",
    title: "Help",
    menuLabel: "Help",
    icon: BadgeHelpIcon,
    content: {
      eyebrow: "Guide",
      heading: "Help",
      paragraphs: [
        "This page is reserved for usage guidance, explanations of study tools, panel behavior, search syntax, and common workflows.",
        "It should later serve as the main reference for using the application efficiently.",
      ],
    },
  },
];

export const STATIC_PAGE_MAP = new Map(
  STATIC_PAGES.map((page) => [page.id, page]),
);

export function getStaticPage(pageId: StaticPageId | null | undefined) {
  return pageId ? STATIC_PAGE_MAP.get(pageId) ?? null : null;
}
