import React from 'react';
import { SEO_CONFIG } from '@/config/seo';

type JsonLdProps = {
  data: Record<string, any>;
};

export const JsonLd: React.FC<JsonLdProps> = ({ data }) => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
};

export const WebPageSchema = ({ title, description, url }: { title: string, description: string, url: string }) => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": url
    }}
  />
);

export const OrganizationSchema = () => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "SkillLinkr",
      "url": "https://www.skilllinkr.com",
      "logo": "https://www.skilllinkr.com/skilllinkr-logo.png",
      "description": "SkillLinkr is a student collaboration platform for finding teammates for projects, hackathons, startups and research."
    }}
  />
);

export const WebSiteSchema = () => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "SkillLinkr",
      "url": "https://www.skilllinkr.com",
      "inLanguage": "en",
      "publisher": {
        "@type": "Organization",
        "name": "SkillLinkr",
        "logo": "https://www.skilllinkr.com/skilllinkr-logo.png"
      }
    }}
  />
);

export const SoftwareApplicationSchema = ({
  name = "SkillLinkr",
  description,
  url,
}: {
  name?: string;
  description: string;
  url: string;
}) => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": name,
      "applicationCategory": "SocialNetworkingApplication",
      "operatingSystem": "Web",
      "description": description,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "url": url
    }}
  />
);

export const FAQSchema: React.FC<{ faqs: { question: string, answer: string }[] }> = ({ faqs }) => {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
  return <JsonLd data={data} />;
};

export const ProfilePageSchema: React.FC<{ name: string, description: string, url: string, image?: string }> = ({ name, description, url, image }) => {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": name,
      "description": description,
      "image": image,
      "url": url
    }
  };
  return <JsonLd data={data} />;
};

export const BreadcrumbSchema = ({
  items,
}: {
  items: { name: string; url: string }[];
}) => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": items.map((item, index) => {
        const absoluteUrl = item.url.startsWith('/') 
          ? `${SEO_CONFIG.siteUrl}${item.url}` 
          : item.url;
        
        return {
          "@type": "ListItem",
          "position": index + 1,
          "name": item.name,
          "item": {
            "@id": absoluteUrl
          }
        };
      })
    }}
  />
);

export const ArticleSchema = ({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName = "SkillLinkr Team"
}: {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
}) => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": description,
      "image": image ? [image] : [],
      "datePublished": datePublished,
      "dateModified": dateModified || datePublished,
      "author": [{
        "@type": "Person",
        "name": authorName,
        "url": "https://www.skilllinkr.com"
      }]
    }}
  />
);
