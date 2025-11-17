# SEO Schema Templates (JSON-LD)

Complete structured data templates for common content types.

## Organization Schema

```javascript
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Organization Name",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "description": "Organization description",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main Street",
    "addressLocality": "City",
    "addressRegion": "ST",
    "postalCode": "12345",
    "addressCountry": "US"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-555-123-4567",
    "contactType": "customer service",
    "email": "support@example.com"
  },
  "sameAs": [
    "https://www.facebook.com/organizationname",
    "https://www.twitter.com/organizationname",
    "https://www.linkedin.com/company/organizationname"
  ]
};
```

## WebSite with SearchAction

```javascript
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Site Name",
  "url": "https://example.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://example.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};
```

## BreadcrumbList

```javascript
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Category",
      "item": "https://example.com/category"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Current Page",
      "item": "https://example.com/category/page"
    }
  ]
};
```

## Article/BlogPosting

```javascript
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Article Title (110 chars max)",
  "description": "Article description",
  "image": [
    "https://example.com/image-1x1.jpg",
    "https://example.com/image-4x3.jpg",
    "https://example.com/image-16x9.jpg"
  ],
  "datePublished": "2024-01-15T08:00:00+00:00",
  "dateModified": "2024-02-20T09:30:00+00:00",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "url": "https://example.com/authors/author-name",
    "description": "Author bio",
    "image": "https://example.com/authors/author-photo.jpg"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png",
      "width": 600,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/article-url"
  },
  "articleSection": "Category Name",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "wordCount": 1500,
  "articleBody": "Full article text..."
};
```

## Product Schema

```javascript
const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "image": [
    "https://example.com/product-image1.jpg",
    "https://example.com/product-image2.jpg"
  ],
  "description": "Product description",
  "sku": "SKU12345",
  "mpn": "MPN12345",
  "brand": {
    "@type": "Brand",
    "name": "Brand Name"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/product",
    "priceCurrency": "USD",
    "price": "99.99",
    "priceValidUntil": "2024-12-31",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Seller Name"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "89",
    "bestRating": "5",
    "worstRating": "1"
  },
  "review": [
    {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "author": {
        "@type": "Person",
        "name": "Reviewer Name"
      },
      "reviewBody": "Review text here...",
      "datePublished": "2024-01-20"
    }
  ]
};
```

## LocalBusiness

```javascript
const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Business Name",
  "image": "https://example.com/business-photo.jpg",
  "@id": "https://example.com",
  "url": "https://example.com",
  "telephone": "+1-555-123-4567",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main Street",
    "addressLocality": "City",
    "addressRegion": "ST",
    "postalCode": "12345",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "17:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "10:00",
      "closes": "14:00"
    }
  ],
  "sameAs": [
    "https://www.facebook.com/businessname",
    "https://www.twitter.com/businessname"
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "250"
  }
};
```

## FAQPage

```javascript
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is your return policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our return policy allows returns within 30 days of purchase with a full refund."
      }
    },
    {
      "@type": "Question",
      "name": "Do you ship internationally?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, we ship to over 50 countries worldwide. Shipping costs vary by location."
      }
    },
    {
      "@type": "Question",
      "name": "How long does shipping take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Domestic shipping takes 3-5 business days. International shipping takes 7-14 business days."
      }
    }
  ]
};
```

## HowTo Schema

```javascript
const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Install a Light Fixture",
  "description": "Complete guide to installing a light fixture safely",
  "image": {
    "@type": "ImageObject",
    "url": "https://example.com/how-to-image.jpg",
    "height": "406",
    "width": "305"
  },
  "totalTime": "PT30M",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": "50"
  },
  "supply": [
    {
      "@type": "HowToSupply",
      "name": "Light fixture"
    },
    {
      "@type": "HowToSupply",
      "name": "Wire nuts"
    },
    {
      "@type": "HowToSupply",
      "name": "Electrical tape"
    }
  ],
  "tool": [
    {
      "@type": "HowToTool",
      "name": "Screwdriver"
    },
    {
      "@type": "HowToTool",
      "name": "Wire stripper"
    }
  ],
  "step": [
    {
      "@type": "HowToStep",
      "name": "Turn off power",
      "text": "Turn off the power at the circuit breaker",
      "image": "https://example.com/step1.jpg",
      "url": "https://example.com/how-to#step1"
    },
    {
      "@type": "HowToStep",
      "name": "Remove old fixture",
      "text": "Carefully remove the existing light fixture",
      "image": "https://example.com/step2.jpg",
      "url": "https://example.com/how-to#step2"
    },
    {
      "@type": "HowToStep",
      "name": "Install new fixture",
      "text": "Connect wires and mount the new fixture",
      "image": "https://example.com/step3.jpg",
      "url": "https://example.com/how-to#step3"
    }
  ]
};
```

## VideoObject

```javascript
const videoSchema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Video Title",
  "description": "Video description",
  "thumbnailUrl": [
    "https://example.com/thumbnail1.jpg",
    "https://example.com/thumbnail2.jpg"
  ],
  "uploadDate": "2024-01-15T08:00:00+00:00",
  "duration": "PT10M30S",
  "contentUrl": "https://example.com/video.mp4",
  "embedUrl": "https://example.com/embed/video",
  "interactionStatistic": {
    "@type": "InteractionCounter",
    "interactionType": {"@type": "WatchAction"},
    "userInteractionCount": 5647018
  },
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  }
};
```

## Event Schema

```javascript
const eventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Event Name",
  "description": "Event description",
  "image": ["https://example.com/event-image.jpg"],
  "startDate": "2024-06-15T19:00:00-05:00",
  "endDate": "2024-06-15T23:00:00-05:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Venue Name",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Main Street",
      "addressLocality": "City",
      "addressRegion": "ST",
      "postalCode": "12345",
      "addressCountry": "US"
    }
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/event-tickets",
    "price": "30",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "validFrom": "2024-05-01T12:00:00-05:00"
  },
  "performer": {
    "@type": "PerformingGroup",
    "name": "Performer Name"
  },
  "organizer": {
    "@type": "Organization",
    "name": "Organizer Name",
    "url": "https://example.com"
  }
};
```

## Review Schema

```javascript
const reviewSchema = {
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": {
    "@type": "Product",
    "name": "Product Name",
    "image": "https://example.com/product.jpg",
    "brand": {
      "@type": "Brand",
      "name": "Brand Name"
    }
  },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "5",
    "bestRating": "5",
    "worstRating": "1"
  },
  "author": {
    "@type": "Person",
    "name": "Reviewer Name"
  },
  "reviewBody": "Detailed review text goes here. Should be substantive and helpful.",
  "datePublished": "2024-01-20",
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name"
  }
};
```

## How to Inject Schema

### Next.js / React

```typescript
// Component with schema
export default function Page({ data }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    // ... schema data
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article>
        {/* Page content */}
      </article>
    </>
  );
}
```

### Static HTML

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title"
}
</script>
```

## Validation

Always validate schema before deployment:
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/

## Best Practices

1. **Use Multiple Types** - Combine relevant schemas (Organization + WebSite + Article)
2. **Keep Updated** - Update dateModified when content changes
3. **Be Accurate** - Schema must match actual page content
4. **Images Matter** - Provide multiple aspect ratios (1x1, 4x3, 16x9)
5. **Test Thoroughly** - Validate before deployment
6. **Monitor Performance** - Check Search Console for structured data errors
