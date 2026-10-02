export const SEO_CONFIG = {
  siteName: "SkillLinkr",
  siteUrl: "https://www.skilllinkr.com",
  defaultTitle: "SkillLinkr | Find Student Teammates for Projects, Hackathons, Startups and Research",
  defaultDescription: "SkillLinkr helps students discover teammates, project partners, hackathon teams, startup cofounders, research collaborators, and skilled peers across colleges.",
  defaultKeywords: [
    "SkillLinkr",
    "student collaboration platform",
    "find teammates",
    "find hackathon teammates",
    "find project partners",
    "student networking app",
    "college networking platform",
    "startup cofounder finder for students",
    "research collaborators",
    "skill based student matching",
    "student team formation",
    "college project collaboration"
  ],
  defaultOgImage: "https://www.skilllinkr.com/og-image.png",
  twitterHandle: "@skilllinkr",
  brandLogo: "https://www.skilllinkr.com/SkillLinkr-logo.png"
};

export const generateMetadata = ({
  title = SEO_CONFIG.defaultTitle,
  description = SEO_CONFIG.defaultDescription,
  path = "",
  image = SEO_CONFIG.defaultOgImage,
  noindex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
}) => {
  const url = `${SEO_CONFIG.siteUrl}${path}`;
  return {
    title,
    description,
    keywords: SEO_CONFIG.defaultKeywords.join(", "),
    authors: [{ name: "SkillLinkr Team" }],
    creator: "SkillLinkr",
    publisher: "SkillLinkr",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      title: SEO_CONFIG.siteName,
      statusBarStyle: "default" as const,
    },
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      title,
      description,
      url,
      siteName: SEO_CONFIG.siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title} - ${SEO_CONFIG.siteName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      creator: SEO_CONFIG.twitterHandle,
      site: SEO_CONFIG.twitterHandle,
    },
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
        'max-video-preview': -1,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
      },
    },
  };
};

export const getGlobalMetadata = generateMetadata;
