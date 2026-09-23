// Original optional context prompts; never scored. Country labels retain source provenance.
export const BACKGROUND={
  "version": "your-story-background-v2",
  "title": "Your Story",
  "required": false,
  "description": "36 optional choice questions plus a report name and optional birthday. These are context and preferences, not a background investigation or a scored cultural test.",
  "identityFields": [
    {
      "id": "displayName",
      "type": "short_text",
      "maxLength": 60,
      "prompt": "What name or nickname should appear on your report?",
      "required": false,
      "export": "Only after explicit approval"
    },
    {
      "id": "birthday",
      "type": "date",
      "prompt": "Want birthday symbols? Add your date of birth, or skip.",
      "required": false,
      "export": "Never export the raw date in the standard packet. Derive only chosen symbols on device."
    }
  ],
  "questions": [
    {
      "id": "bg01",
      "chapter": "You",
      "prompt": "Which age range would you like the report to use?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Under 18"
        },
        {
          "id": "o02",
          "label": "18-24"
        },
        {
          "id": "o03",
          "label": "25-34"
        },
        {
          "id": "o04",
          "label": "35-44"
        },
        {
          "id": "o05",
          "label": "45-54"
        },
        {
          "id": "o06",
          "label": "55-64"
        },
        {
          "id": "o07",
          "label": "65-74"
        },
        {
          "id": "o08",
          "label": "75 or older"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Age-appropriate examples only; do not infer maturity or ability.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg02",
      "chapter": "You",
      "prompt": "Which pronouns should the report use?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "She/her"
        },
        {
          "id": "o02",
          "label": "He/him"
        },
        {
          "id": "o03",
          "label": "They/them"
        },
        {
          "id": "o04",
          "label": "Use my report name only"
        },
        {
          "id": "o05",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Use the selected language without inferring gender.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg03",
      "chapter": "You",
      "prompt": "Which gender descriptions, if any, would you like included?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Woman"
        },
        {
          "id": "o02",
          "label": "Man"
        },
        {
          "id": "o03",
          "label": "Nonbinary"
        },
        {
          "id": "o04",
          "label": "Genderfluid"
        },
        {
          "id": "o05",
          "label": "Agender"
        },
        {
          "id": "o06",
          "label": "Questioning"
        },
        {
          "id": "o07",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Identity acknowledgement only; no trait or relationship assumptions.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg04",
      "chapter": "Your roots",
      "prompt": "Which racial or ethnic descriptions, if any, do you use for yourself?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Black / African / African diaspora"
        },
        {
          "id": "o02",
          "label": "Hispanic / Latino / Latina / Latine"
        },
        {
          "id": "o03",
          "label": "White / European heritage"
        },
        {
          "id": "o04",
          "label": "East Asian"
        },
        {
          "id": "o05",
          "label": "South Asian"
        },
        {
          "id": "o06",
          "label": "Southeast Asian"
        },
        {
          "id": "o07",
          "label": "Middle Eastern / North African"
        },
        {
          "id": "o08",
          "label": "Indigenous / Native heritage"
        },
        {
          "id": "o09",
          "label": "Pacific Islander"
        },
        {
          "id": "o10",
          "label": "Another identity - Self-describe"
        },
        {
          "id": "o11",
          "label": "None of these descriptions",
          "exclusive": true
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Use only self-described labels. These broad, partly US-oriented options are not cultures, biological personality types, or mutually exclusive categories.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg05",
      "chapter": "Your roots",
      "prompt": "In which country or territory were you born?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Not sure"
        },
        {
          "id": "o02",
          "label": "Another place - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": "countries-v1",
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Geographical biography only; not citizenship, ethnicity, or a cultural score.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg06",
      "chapter": "Your roots",
      "prompt": "Where did you spend substantial parts of childhood, roughly ages 5-15?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Not sure"
        },
        {
          "id": "o02",
          "label": "Another place - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": "countries-v1",
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Multiple formative settings; do not substitute birthplace for upbringing.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg07",
      "chapter": "Your roots",
      "prompt": "Where do you live now?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Prefer a broad description - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": "countries-v1",
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Only if relevant to a user-selected goal. No city, address, or geolocation needed.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg08",
      "chapter": "Your roots",
      "prompt": "Which description best fits your experience of moving between countries?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "I have lived mainly in one country"
        },
        {
          "id": "o02",
          "label": "I moved countries during childhood"
        },
        {
          "id": "o03",
          "label": "I first moved countries as an adult"
        },
        {
          "id": "o04",
          "label": "I have moved countries several times"
        },
        {
          "id": "o05",
          "label": "I regularly live across countries"
        },
        {
          "id": "o06",
          "label": "My experience is different - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Frame transitions without inferring immigration status or why someone moved.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg09",
      "chapter": "Your roots",
      "prompt": "What kinds of places did you grow up in?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Large city"
        },
        {
          "id": "o02",
          "label": "Smaller city"
        },
        {
          "id": "o03",
          "label": "Suburb"
        },
        {
          "id": "o04",
          "label": "Small town"
        },
        {
          "id": "o05",
          "label": "Rural or agricultural area"
        },
        {
          "id": "o06",
          "label": "Several different settings"
        },
        {
          "id": "o07",
          "label": "Another setting - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Describe the setting, not presumed sophistication or collectivism.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg10",
      "chapter": "Your roots",
      "prompt": "Which languages were regularly used in your home while growing up?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "English"
        },
        {
          "id": "o02",
          "label": "Spanish"
        },
        {
          "id": "o03",
          "label": "Mandarin Chinese"
        },
        {
          "id": "o04",
          "label": "Cantonese"
        },
        {
          "id": "o05",
          "label": "Hindi"
        },
        {
          "id": "o06",
          "label": "Urdu"
        },
        {
          "id": "o07",
          "label": "Arabic"
        },
        {
          "id": "o08",
          "label": "Portuguese"
        },
        {
          "id": "o09",
          "label": "French"
        },
        {
          "id": "o10",
          "label": "Bengali"
        },
        {
          "id": "o11",
          "label": "Russian"
        },
        {
          "id": "o12",
          "label": "Japanese"
        },
        {
          "id": "o13",
          "label": "Korean"
        },
        {
          "id": "o14",
          "label": "Vietnamese"
        },
        {
          "id": "o15",
          "label": "Tagalog / Filipino"
        },
        {
          "id": "o16",
          "label": "Swahili"
        },
        {
          "id": "o17",
          "label": "A signed language - Self-describe"
        },
        {
          "id": "o18",
          "label": "Another language - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Language context only; do not infer nationality or language proficiency.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg11",
      "chapter": "Your roots",
      "prompt": "Who were regularly part of your household or daily care while growing up?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Parent or parents"
        },
        {
          "id": "o02",
          "label": "Grandparent or grandparents"
        },
        {
          "id": "o03",
          "label": "Other relatives"
        },
        {
          "id": "o04",
          "label": "Guardians or foster carers"
        },
        {
          "id": "o05",
          "label": "Siblings or cousins"
        },
        {
          "id": "o06",
          "label": "Unrelated adults or community carers"
        },
        {
          "id": "o07",
          "label": "Household members changed over time"
        },
        {
          "id": "o08",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Acknowledge lived family arrangements without ranking them or assuming trauma.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg12",
      "chapter": "Your roots",
      "prompt": "How present were cultural, family, or spiritual traditions in everyday life?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Very present"
        },
        {
          "id": "o02",
          "label": "Somewhat present"
        },
        {
          "id": "o03",
          "label": "Occasionally present"
        },
        {
          "id": "o04",
          "label": "Rarely present"
        },
        {
          "id": "o05",
          "label": "It varied across households or periods"
        },
        {
          "id": "o06",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Reported exposure only; not a religion or belief inference.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg13",
      "chapter": "Your roots",
      "prompt": "Which communities or traditions would you like the story to acknowledge?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Local or regional community"
        },
        {
          "id": "o02",
          "label": "Family or ancestral traditions"
        },
        {
          "id": "o03",
          "label": "National or diaspora community"
        },
        {
          "id": "o04",
          "label": "Religious or spiritual community"
        },
        {
          "id": "o05",
          "label": "Chosen family or friendship community"
        },
        {
          "id": "o06",
          "label": "Professional or creative community"
        },
        {
          "id": "o07",
          "label": "Online community"
        },
        {
          "id": "o08",
          "label": "None in particular",
          "exclusive": true
        },
        {
          "id": "o09",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Let respondents name meaningful belonging. Never guess a religion or tradition.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg14",
      "chapter": "Your circumstances",
      "prompt": "How predictable was access to everyday essentials while you were growing up?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Usually predictable"
        },
        {
          "id": "o02",
          "label": "Mostly predictable with occasional pressure"
        },
        {
          "id": "o03",
          "label": "Often uncertain"
        },
        {
          "id": "o04",
          "label": "It changed substantially over time"
        },
        {
          "id": "o05",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Context for opportunities and constraints, never a personality deficit or diagnosis.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg15",
      "chapter": "Your circumstances",
      "prompt": "How much room do you currently have for optional spending or new commitments?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Very little room"
        },
        {
          "id": "o02",
          "label": "Some room if I plan carefully"
        },
        {
          "id": "o03",
          "label": "Comfortable room"
        },
        {
          "id": "o04",
          "label": "It varies a lot"
        },
        {
          "id": "o05",
          "label": "I would rather use no-cost suggestions"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Adjust the cost of suggested activities; do not infer income or social class.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg16",
      "chapter": "Your circumstances",
      "prompt": "Which learning paths have been part of your life?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "School education"
        },
        {
          "id": "o02",
          "label": "Vocational training or apprenticeship"
        },
        {
          "id": "o03",
          "label": "College or university study"
        },
        {
          "id": "o04",
          "label": "Postgraduate study"
        },
        {
          "id": "o05",
          "label": "Work-based learning"
        },
        {
          "id": "o06",
          "label": "Independent or community learning"
        },
        {
          "id": "o07",
          "label": "Another path - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Choose accessible examples without equating credentials with intelligence.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg17",
      "chapter": "Your circumstances",
      "prompt": "Which roles are part of your life right now?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Student or learner"
        },
        {
          "id": "o02",
          "label": "Employee"
        },
        {
          "id": "o03",
          "label": "Self-employed or business owner"
        },
        {
          "id": "o04",
          "label": "Looking for work"
        },
        {
          "id": "o05",
          "label": "Unpaid caregiver"
        },
        {
          "id": "o06",
          "label": "Homemaker or household organizer"
        },
        {
          "id": "o07",
          "label": "Volunteer or community organizer"
        },
        {
          "id": "o08",
          "label": "Retired"
        },
        {
          "id": "o09",
          "label": "Taking time away from paid work"
        },
        {
          "id": "o10",
          "label": "Another role - Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Ground the story in current roles without inferring employability.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg18",
      "chapter": "Your circumstances",
      "prompt": "Which ongoing responsibilities should suggestions take into account?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Caring for children"
        },
        {
          "id": "o02",
          "label": "Supporting adults or elders"
        },
        {
          "id": "o03",
          "label": "Supporting family or friends financially"
        },
        {
          "id": "o04",
          "label": "Managing a household"
        },
        {
          "id": "o05",
          "label": "Community responsibilities"
        },
        {
          "id": "o06",
          "label": "Study or training"
        },
        {
          "id": "o07",
          "label": "Paid work commitments"
        },
        {
          "id": "o08",
          "label": "None of these",
          "exclusive": true
        },
        {
          "id": "o09",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Practical load and available support, not virtue or compliance.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg19",
      "chapter": "Your circumstances",
      "prompt": "How much control do you usually have over your daily schedule?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Very little"
        },
        {
          "id": "o02",
          "label": "Some"
        },
        {
          "id": "o03",
          "label": "A moderate amount"
        },
        {
          "id": "o04",
          "label": "A great deal"
        },
        {
          "id": "o05",
          "label": "It changes from week to week"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Distinguish preferred routines from actual freedom to choose.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg20",
      "chapter": "Your circumstances",
      "prompt": "What amount of time feels realistic for a small personal experiment?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "About 5 minutes"
        },
        {
          "id": "o02",
          "label": "About 15 minutes"
        },
        {
          "id": "o03",
          "label": "About 30 minutes"
        },
        {
          "id": "o04",
          "label": "About an hour"
        },
        {
          "id": "o05",
          "label": "A flexible block once a week"
        },
        {
          "id": "o06",
          "label": "Not taking on anything new right now"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Set an achievable action, not a motivation score.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg21",
      "chapter": "Your next chapter",
      "prompt": "What would you most like this report to help you explore?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Understanding myself"
        },
        {
          "id": "o02",
          "label": "Work or study choices"
        },
        {
          "id": "o03",
          "label": "Communication"
        },
        {
          "id": "o04",
          "label": "Relationships or friendship"
        },
        {
          "id": "o05",
          "label": "Creativity"
        },
        {
          "id": "o06",
          "label": "Routines and follow-through"
        },
        {
          "id": "o07",
          "label": "Belonging and identity"
        },
        {
          "id": "o08",
          "label": "A current transition"
        },
        {
          "id": "o09",
          "label": "Simply having fun"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 8,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Anchor the narrative and next step to selected goals.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg22",
      "chapter": "Your next chapter",
      "prompt": "Which changes are shaping this period of your life?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "New work or study"
        },
        {
          "id": "o02",
          "label": "Moving home or country"
        },
        {
          "id": "o03",
          "label": "Changing relationships or household"
        },
        {
          "id": "o04",
          "label": "New caring responsibilities"
        },
        {
          "id": "o05",
          "label": "Changing finances or available time"
        },
        {
          "id": "o06",
          "label": "Retirement or stepping back"
        },
        {
          "id": "o07",
          "label": "Exploring a new direction"
        },
        {
          "id": "o08",
          "label": "A fairly settled period"
        },
        {
          "id": "o09",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Mention only the selected transition; never invent loss, conflict, or trauma.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg23",
      "chapter": "Rules and belonging",
      "prompt": "While growing up, how clearly did people around you agree on what was acceptable behavior?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Very clearly"
        },
        {
          "id": "o02",
          "label": "Fairly clearly"
        },
        {
          "id": "o03",
          "label": "Somewhat"
        },
        {
          "id": "o04",
          "label": "There was little shared agreement"
        },
        {
          "id": "o05",
          "label": "Different groups had different expectations"
        },
        {
          "id": "o06",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Direct description of perceived norms; not a validated tightness score.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg24",
      "chapter": "Rules and belonging",
      "prompt": "When someone departed from those expectations, what usually happened?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Little reaction"
        },
        {
          "id": "o02",
          "label": "Questions or gentle reminders"
        },
        {
          "id": "o03",
          "label": "Clear criticism or social disapproval"
        },
        {
          "id": "o04",
          "label": "Strong consequences or exclusion"
        },
        {
          "id": "o05",
          "label": "It depended greatly on the behavior or group"
        },
        {
          "id": "o06",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": true,
      "scoreWeight": 0,
      "narrativeUse": "Perceived enforcement; do not infer abuse or diagnose a family.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg25",
      "chapter": "Rules and belonging",
      "prompt": "In the communities you spend time with now, how much variation in behavior is accepted?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "A very wide range"
        },
        {
          "id": "o02",
          "label": "A fairly wide range"
        },
        {
          "id": "o03",
          "label": "A moderate range"
        },
        {
          "id": "o04",
          "label": "A fairly narrow range"
        },
        {
          "id": "o05",
          "label": "A very narrow range"
        },
        {
          "id": "o06",
          "label": "It differs between communities"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Current experience, distinct from childhood and personal preference.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg26",
      "chapter": "Rules and belonging",
      "prompt": "Growing up, how many different ways of living a good life seemed acceptable?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Many different paths"
        },
        {
          "id": "o02",
          "label": "Several paths"
        },
        {
          "id": "o03",
          "label": "A few paths"
        },
        {
          "id": "o04",
          "label": "One main expected path"
        },
        {
          "id": "o05",
          "label": "It depended on the household or community"
        },
        {
          "id": "o06",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Narrative context for autonomy without assuming national culture.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg27",
      "chapter": "Rules and belonging",
      "prompt": "How are major personal decisions usually made in your life now?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Mostly by me"
        },
        {
          "id": "o02",
          "label": "By me after advice from others"
        },
        {
          "id": "o03",
          "label": "Jointly with people affected"
        },
        {
          "id": "o04",
          "label": "Family or community expectations strongly shape them"
        },
        {
          "id": "o05",
          "label": "It depends on the decision"
        },
        {
          "id": "o06",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Reported decision process, not a moral ranking of independence.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg28",
      "chapter": "Rules and belonging",
      "prompt": "How often did everyday needs in your upbringing depend on people coordinating work or helping one another?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Rarely"
        },
        {
          "id": "o02",
          "label": "Sometimes"
        },
        {
          "id": "o03",
          "label": "Often"
        },
        {
          "id": "o04",
          "label": "Very often"
        },
        {
          "id": "o05",
          "label": "It changed over time"
        },
        {
          "id": "o06",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Ask about actual interdependence; do not infer agricultural ancestry or diet.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg29",
      "chapter": "Rules and belonging",
      "prompt": "How much freedom did you have to explore interests that differed from those around you?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "A great deal"
        },
        {
          "id": "o02",
          "label": "A fair amount"
        },
        {
          "id": "o03",
          "label": "Some"
        },
        {
          "id": "o04",
          "label": "Very little"
        },
        {
          "id": "o05",
          "label": "It varied across settings"
        },
        {
          "id": "o06",
          "label": "Not sure"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Directly reported room to explore; not a causal explanation of personality.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg30",
      "chapter": "Rules and belonging",
      "prompt": "When moving between social or cultural settings, what feels most familiar?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "I behave much the same"
        },
        {
          "id": "o02",
          "label": "I adjust comfortably"
        },
        {
          "id": "o03",
          "label": "I adjust, but it takes effort"
        },
        {
          "id": "o04",
          "label": "I feel pulled between different expectations"
        },
        {
          "id": "o05",
          "label": "I have little experience of this"
        },
        {
          "id": "o06",
          "label": "It varies"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Context switching described by the respondent; no authenticity judgment.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg31",
      "chapter": "Your next chapter",
      "prompt": "What kinds of support tend to help you make a decision?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Concrete information"
        },
        {
          "id": "o02",
          "label": "Time to reflect privately"
        },
        {
          "id": "o03",
          "label": "Talking with someone I trust"
        },
        {
          "id": "o04",
          "label": "Trying a small experiment"
        },
        {
          "id": "o05",
          "label": "Expert or mentor guidance"
        },
        {
          "id": "o06",
          "label": "Family or community discussion"
        },
        {
          "id": "o07",
          "label": "Creative or symbolic prompts"
        },
        {
          "id": "o08",
          "label": "Self-describe"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": true,
      "maxSelections": 8,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Choose the form of support the respondent endorses.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg32",
      "chapter": "Your next chapter",
      "prompt": "How would you like suggestions to be phrased?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Direct and concise"
        },
        {
          "id": "o02",
          "label": "Warm and encouraging"
        },
        {
          "id": "o03",
          "label": "Reflective, with questions"
        },
        {
          "id": "o04",
          "label": "Balanced: candid and supportive"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Writing style only.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg33",
      "chapter": "Your next chapter",
      "prompt": "Which format would help you act on the report?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "One tiny next step"
        },
        {
          "id": "o02",
          "label": "A short checklist"
        },
        {
          "id": "o03",
          "label": "A week-long experiment"
        },
        {
          "id": "o04",
          "label": "A conversation starter"
        },
        {
          "id": "o05",
          "label": "Journal prompts"
        },
        {
          "id": "o06",
          "label": "I only want the story today"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Choose the closing activity format.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg34",
      "chapter": "Make it yours",
      "prompt": "What kind of report would you enjoy?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "Practical and straightforward"
        },
        {
          "id": "o02",
          "label": "A story with some visual symbolism"
        },
        {
          "id": "o03",
          "label": "A playful, richly illustrated story"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Tone and layout; never reduce factual accuracy for the playful setting.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg35",
      "chapter": "Make it yours",
      "prompt": "Which optional symbolic features would you like?",
      "type": "multi_select",
      "options": [
        {
          "id": "o01",
          "label": "Western zodiac (approximate birthday sun-sign convention)"
        },
        {
          "id": "o02",
          "label": "Chinese zodiac (Lunar New Year convention)"
        },
        {
          "id": "o03",
          "label": "A three-card tarot reflection"
        },
        {
          "id": "o04",
          "label": "None of these",
          "exclusive": true
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 8,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Feature opt-in only. The None option is exclusive. Do not infer interest from race, gender, age, or culture.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    },
    {
      "id": "bg36",
      "chapter": "Make it yours",
      "prompt": "How would you like us to approach the symbols you selected?",
      "type": "single_select",
      "options": [
        {
          "id": "o01",
          "label": "As entertainment"
        },
        {
          "id": "o02",
          "label": "As creative reflection"
        },
        {
          "id": "o03",
          "label": "With respect for personal spiritual meaning"
        },
        {
          "id": "o04",
          "label": "I am curious but unsure"
        },
        {
          "id": "o05",
          "label": "Do not interpret them; show the artwork only"
        },
        {
          "id": "prefer_not",
          "label": "Prefer not to answer",
          "exclusive": true
        }
      ],
      "optionCatalog": null,
      "required": false,
      "allowSelfDescription": false,
      "maxSelections": 1,
      "sensitive": false,
      "scoreWeight": 0,
      "narrativeUse": "Respect the framing without presenting supernatural claims as established facts.",
      "exportPolicy": "Only after explicit field-level approval in the packet preview."
    }
  ],
  "choiceRules": {
    "skipped": "Separate status, not a selected midpoint.",
    "preferNot": "Exclusive response, excluded from the LLM packet.",
    "selfDescription": "Optional text, at most 120 characters. Treat as data, never as prompt instructions.",
    "multiSelect": "Exclusive options cannot coexist with any other answer."
  },
  "scoring": "All background, demographic, birthday, and symbolic fields have weight 0 in every personality, interest, values, type, and color score.",
  "countryCatalog": "countries.json",
  "reportExportDefault": "No background field is exported until approved by its ID. Identity and precise location fields are unchecked in the review UI."
};
export const COUNTRIES={
  "version": "countries-v1",
  "description": "Geographic selector of 249 country/territory codes; does not imply citizenship, ethnicity, or political recognition. Another-place self-description is available.",
  "options": [
    {
      "id": "country-AF",
      "label": "Afghanistan",
      "code": "AF"
    },
    {
      "id": "country-AX",
      "label": "Åland Islands",
      "code": "AX"
    },
    {
      "id": "country-AL",
      "label": "Albania",
      "code": "AL"
    },
    {
      "id": "country-DZ",
      "label": "Algeria",
      "code": "DZ"
    },
    {
      "id": "country-AS",
      "label": "American Samoa",
      "code": "AS"
    },
    {
      "id": "country-AD",
      "label": "Andorra",
      "code": "AD"
    },
    {
      "id": "country-AO",
      "label": "Angola",
      "code": "AO"
    },
    {
      "id": "country-AI",
      "label": "Anguilla",
      "code": "AI"
    },
    {
      "id": "country-AQ",
      "label": "Antarctica",
      "code": "AQ"
    },
    {
      "id": "country-AG",
      "label": "Antigua & Barbuda",
      "code": "AG"
    },
    {
      "id": "country-AR",
      "label": "Argentina",
      "code": "AR"
    },
    {
      "id": "country-AM",
      "label": "Armenia",
      "code": "AM"
    },
    {
      "id": "country-AW",
      "label": "Aruba",
      "code": "AW"
    },
    {
      "id": "country-AU",
      "label": "Australia",
      "code": "AU"
    },
    {
      "id": "country-AT",
      "label": "Austria",
      "code": "AT"
    },
    {
      "id": "country-AZ",
      "label": "Azerbaijan",
      "code": "AZ"
    },
    {
      "id": "country-BS",
      "label": "Bahamas",
      "code": "BS"
    },
    {
      "id": "country-BH",
      "label": "Bahrain",
      "code": "BH"
    },
    {
      "id": "country-BD",
      "label": "Bangladesh",
      "code": "BD"
    },
    {
      "id": "country-BB",
      "label": "Barbados",
      "code": "BB"
    },
    {
      "id": "country-BY",
      "label": "Belarus",
      "code": "BY"
    },
    {
      "id": "country-BE",
      "label": "Belgium",
      "code": "BE"
    },
    {
      "id": "country-BZ",
      "label": "Belize",
      "code": "BZ"
    },
    {
      "id": "country-BJ",
      "label": "Benin",
      "code": "BJ"
    },
    {
      "id": "country-BM",
      "label": "Bermuda",
      "code": "BM"
    },
    {
      "id": "country-BT",
      "label": "Bhutan",
      "code": "BT"
    },
    {
      "id": "country-BO",
      "label": "Bolivia",
      "code": "BO"
    },
    {
      "id": "country-BA",
      "label": "Bosnia & Herzegovina",
      "code": "BA"
    },
    {
      "id": "country-BW",
      "label": "Botswana",
      "code": "BW"
    },
    {
      "id": "country-BV",
      "label": "Bouvet Island",
      "code": "BV"
    },
    {
      "id": "country-BR",
      "label": "Brazil",
      "code": "BR"
    },
    {
      "id": "country-IO",
      "label": "British Indian Ocean Territory",
      "code": "IO"
    },
    {
      "id": "country-VG",
      "label": "British Virgin Islands",
      "code": "VG"
    },
    {
      "id": "country-BN",
      "label": "Brunei",
      "code": "BN"
    },
    {
      "id": "country-BG",
      "label": "Bulgaria",
      "code": "BG"
    },
    {
      "id": "country-BF",
      "label": "Burkina Faso",
      "code": "BF"
    },
    {
      "id": "country-BI",
      "label": "Burundi",
      "code": "BI"
    },
    {
      "id": "country-KH",
      "label": "Cambodia",
      "code": "KH"
    },
    {
      "id": "country-CM",
      "label": "Cameroon",
      "code": "CM"
    },
    {
      "id": "country-CA",
      "label": "Canada",
      "code": "CA"
    },
    {
      "id": "country-CV",
      "label": "Cape Verde",
      "code": "CV"
    },
    {
      "id": "country-BQ",
      "label": "Caribbean Netherlands",
      "code": "BQ"
    },
    {
      "id": "country-KY",
      "label": "Cayman Islands",
      "code": "KY"
    },
    {
      "id": "country-CF",
      "label": "Central African Republic",
      "code": "CF"
    },
    {
      "id": "country-TD",
      "label": "Chad",
      "code": "TD"
    },
    {
      "id": "country-CL",
      "label": "Chile",
      "code": "CL"
    },
    {
      "id": "country-CN",
      "label": "China",
      "code": "CN"
    },
    {
      "id": "country-CX",
      "label": "Christmas Island",
      "code": "CX"
    },
    {
      "id": "country-CC",
      "label": "Cocos (Keeling) Islands",
      "code": "CC"
    },
    {
      "id": "country-CO",
      "label": "Colombia",
      "code": "CO"
    },
    {
      "id": "country-KM",
      "label": "Comoros",
      "code": "KM"
    },
    {
      "id": "country-CG",
      "label": "Congo - Brazzaville",
      "code": "CG"
    },
    {
      "id": "country-CD",
      "label": "Congo - Kinshasa",
      "code": "CD"
    },
    {
      "id": "country-CK",
      "label": "Cook Islands",
      "code": "CK"
    },
    {
      "id": "country-CR",
      "label": "Costa Rica",
      "code": "CR"
    },
    {
      "id": "country-CI",
      "label": "Côte d’Ivoire",
      "code": "CI"
    },
    {
      "id": "country-HR",
      "label": "Croatia",
      "code": "HR"
    },
    {
      "id": "country-CU",
      "label": "Cuba",
      "code": "CU"
    },
    {
      "id": "country-CW",
      "label": "Curaçao",
      "code": "CW"
    },
    {
      "id": "country-CY",
      "label": "Cyprus",
      "code": "CY"
    },
    {
      "id": "country-CZ",
      "label": "Czechia",
      "code": "CZ"
    },
    {
      "id": "country-DK",
      "label": "Denmark",
      "code": "DK"
    },
    {
      "id": "country-DJ",
      "label": "Djibouti",
      "code": "DJ"
    },
    {
      "id": "country-DM",
      "label": "Dominica",
      "code": "DM"
    },
    {
      "id": "country-DO",
      "label": "Dominican Republic",
      "code": "DO"
    },
    {
      "id": "country-EC",
      "label": "Ecuador",
      "code": "EC"
    },
    {
      "id": "country-EG",
      "label": "Egypt",
      "code": "EG"
    },
    {
      "id": "country-SV",
      "label": "El Salvador",
      "code": "SV"
    },
    {
      "id": "country-GQ",
      "label": "Equatorial Guinea",
      "code": "GQ"
    },
    {
      "id": "country-ER",
      "label": "Eritrea",
      "code": "ER"
    },
    {
      "id": "country-EE",
      "label": "Estonia",
      "code": "EE"
    },
    {
      "id": "country-SZ",
      "label": "Eswatini",
      "code": "SZ"
    },
    {
      "id": "country-ET",
      "label": "Ethiopia",
      "code": "ET"
    },
    {
      "id": "country-FK",
      "label": "Falkland Islands",
      "code": "FK"
    },
    {
      "id": "country-FO",
      "label": "Faroe Islands",
      "code": "FO"
    },
    {
      "id": "country-FJ",
      "label": "Fiji",
      "code": "FJ"
    },
    {
      "id": "country-FI",
      "label": "Finland",
      "code": "FI"
    },
    {
      "id": "country-FR",
      "label": "France",
      "code": "FR"
    },
    {
      "id": "country-GF",
      "label": "French Guiana",
      "code": "GF"
    },
    {
      "id": "country-PF",
      "label": "French Polynesia",
      "code": "PF"
    },
    {
      "id": "country-TF",
      "label": "French Southern Territories",
      "code": "TF"
    },
    {
      "id": "country-GA",
      "label": "Gabon",
      "code": "GA"
    },
    {
      "id": "country-GM",
      "label": "Gambia",
      "code": "GM"
    },
    {
      "id": "country-GE",
      "label": "Georgia",
      "code": "GE"
    },
    {
      "id": "country-DE",
      "label": "Germany",
      "code": "DE"
    },
    {
      "id": "country-GH",
      "label": "Ghana",
      "code": "GH"
    },
    {
      "id": "country-GI",
      "label": "Gibraltar",
      "code": "GI"
    },
    {
      "id": "country-GR",
      "label": "Greece",
      "code": "GR"
    },
    {
      "id": "country-GL",
      "label": "Greenland",
      "code": "GL"
    },
    {
      "id": "country-GD",
      "label": "Grenada",
      "code": "GD"
    },
    {
      "id": "country-GP",
      "label": "Guadeloupe",
      "code": "GP"
    },
    {
      "id": "country-GU",
      "label": "Guam",
      "code": "GU"
    },
    {
      "id": "country-GT",
      "label": "Guatemala",
      "code": "GT"
    },
    {
      "id": "country-GG",
      "label": "Guernsey",
      "code": "GG"
    },
    {
      "id": "country-GN",
      "label": "Guinea",
      "code": "GN"
    },
    {
      "id": "country-GW",
      "label": "Guinea-Bissau",
      "code": "GW"
    },
    {
      "id": "country-GY",
      "label": "Guyana",
      "code": "GY"
    },
    {
      "id": "country-HT",
      "label": "Haiti",
      "code": "HT"
    },
    {
      "id": "country-HM",
      "label": "Heard & McDonald Islands",
      "code": "HM"
    },
    {
      "id": "country-HN",
      "label": "Honduras",
      "code": "HN"
    },
    {
      "id": "country-HK",
      "label": "Hong Kong SAR China",
      "code": "HK"
    },
    {
      "id": "country-HU",
      "label": "Hungary",
      "code": "HU"
    },
    {
      "id": "country-IS",
      "label": "Iceland",
      "code": "IS"
    },
    {
      "id": "country-IN",
      "label": "India",
      "code": "IN"
    },
    {
      "id": "country-ID",
      "label": "Indonesia",
      "code": "ID"
    },
    {
      "id": "country-IR",
      "label": "Iran",
      "code": "IR"
    },
    {
      "id": "country-IQ",
      "label": "Iraq",
      "code": "IQ"
    },
    {
      "id": "country-IE",
      "label": "Ireland",
      "code": "IE"
    },
    {
      "id": "country-IM",
      "label": "Isle of Man",
      "code": "IM"
    },
    {
      "id": "country-IL",
      "label": "Israel",
      "code": "IL"
    },
    {
      "id": "country-IT",
      "label": "Italy",
      "code": "IT"
    },
    {
      "id": "country-JM",
      "label": "Jamaica",
      "code": "JM"
    },
    {
      "id": "country-JP",
      "label": "Japan",
      "code": "JP"
    },
    {
      "id": "country-JE",
      "label": "Jersey",
      "code": "JE"
    },
    {
      "id": "country-JO",
      "label": "Jordan",
      "code": "JO"
    },
    {
      "id": "country-KZ",
      "label": "Kazakhstan",
      "code": "KZ"
    },
    {
      "id": "country-KE",
      "label": "Kenya",
      "code": "KE"
    },
    {
      "id": "country-KI",
      "label": "Kiribati",
      "code": "KI"
    },
    {
      "id": "country-KW",
      "label": "Kuwait",
      "code": "KW"
    },
    {
      "id": "country-KG",
      "label": "Kyrgyzstan",
      "code": "KG"
    },
    {
      "id": "country-LA",
      "label": "Laos",
      "code": "LA"
    },
    {
      "id": "country-LV",
      "label": "Latvia",
      "code": "LV"
    },
    {
      "id": "country-LB",
      "label": "Lebanon",
      "code": "LB"
    },
    {
      "id": "country-LS",
      "label": "Lesotho",
      "code": "LS"
    },
    {
      "id": "country-LR",
      "label": "Liberia",
      "code": "LR"
    },
    {
      "id": "country-LY",
      "label": "Libya",
      "code": "LY"
    },
    {
      "id": "country-LI",
      "label": "Liechtenstein",
      "code": "LI"
    },
    {
      "id": "country-LT",
      "label": "Lithuania",
      "code": "LT"
    },
    {
      "id": "country-LU",
      "label": "Luxembourg",
      "code": "LU"
    },
    {
      "id": "country-MO",
      "label": "Macao SAR China",
      "code": "MO"
    },
    {
      "id": "country-MG",
      "label": "Madagascar",
      "code": "MG"
    },
    {
      "id": "country-MW",
      "label": "Malawi",
      "code": "MW"
    },
    {
      "id": "country-MY",
      "label": "Malaysia",
      "code": "MY"
    },
    {
      "id": "country-MV",
      "label": "Maldives",
      "code": "MV"
    },
    {
      "id": "country-ML",
      "label": "Mali",
      "code": "ML"
    },
    {
      "id": "country-MT",
      "label": "Malta",
      "code": "MT"
    },
    {
      "id": "country-MH",
      "label": "Marshall Islands",
      "code": "MH"
    },
    {
      "id": "country-MQ",
      "label": "Martinique",
      "code": "MQ"
    },
    {
      "id": "country-MR",
      "label": "Mauritania",
      "code": "MR"
    },
    {
      "id": "country-MU",
      "label": "Mauritius",
      "code": "MU"
    },
    {
      "id": "country-YT",
      "label": "Mayotte",
      "code": "YT"
    },
    {
      "id": "country-MX",
      "label": "Mexico",
      "code": "MX"
    },
    {
      "id": "country-FM",
      "label": "Micronesia",
      "code": "FM"
    },
    {
      "id": "country-MD",
      "label": "Moldova",
      "code": "MD"
    },
    {
      "id": "country-MC",
      "label": "Monaco",
      "code": "MC"
    },
    {
      "id": "country-MN",
      "label": "Mongolia",
      "code": "MN"
    },
    {
      "id": "country-ME",
      "label": "Montenegro",
      "code": "ME"
    },
    {
      "id": "country-MS",
      "label": "Montserrat",
      "code": "MS"
    },
    {
      "id": "country-MA",
      "label": "Morocco",
      "code": "MA"
    },
    {
      "id": "country-MZ",
      "label": "Mozambique",
      "code": "MZ"
    },
    {
      "id": "country-MM",
      "label": "Myanmar (Burma)",
      "code": "MM"
    },
    {
      "id": "country-NA",
      "label": "Namibia",
      "code": "NA"
    },
    {
      "id": "country-NR",
      "label": "Nauru",
      "code": "NR"
    },
    {
      "id": "country-NP",
      "label": "Nepal",
      "code": "NP"
    },
    {
      "id": "country-NL",
      "label": "Netherlands",
      "code": "NL"
    },
    {
      "id": "country-NC",
      "label": "New Caledonia",
      "code": "NC"
    },
    {
      "id": "country-NZ",
      "label": "New Zealand",
      "code": "NZ"
    },
    {
      "id": "country-NI",
      "label": "Nicaragua",
      "code": "NI"
    },
    {
      "id": "country-NE",
      "label": "Niger",
      "code": "NE"
    },
    {
      "id": "country-NG",
      "label": "Nigeria",
      "code": "NG"
    },
    {
      "id": "country-NU",
      "label": "Niue",
      "code": "NU"
    },
    {
      "id": "country-NF",
      "label": "Norfolk Island",
      "code": "NF"
    },
    {
      "id": "country-KP",
      "label": "North Korea",
      "code": "KP"
    },
    {
      "id": "country-MK",
      "label": "North Macedonia",
      "code": "MK"
    },
    {
      "id": "country-MP",
      "label": "Northern Mariana Islands",
      "code": "MP"
    },
    {
      "id": "country-NO",
      "label": "Norway",
      "code": "NO"
    },
    {
      "id": "country-OM",
      "label": "Oman",
      "code": "OM"
    },
    {
      "id": "country-PK",
      "label": "Pakistan",
      "code": "PK"
    },
    {
      "id": "country-PW",
      "label": "Palau",
      "code": "PW"
    },
    {
      "id": "country-PS",
      "label": "Palestinian Territories",
      "code": "PS"
    },
    {
      "id": "country-PA",
      "label": "Panama",
      "code": "PA"
    },
    {
      "id": "country-PG",
      "label": "Papua New Guinea",
      "code": "PG"
    },
    {
      "id": "country-PY",
      "label": "Paraguay",
      "code": "PY"
    },
    {
      "id": "country-PE",
      "label": "Peru",
      "code": "PE"
    },
    {
      "id": "country-PH",
      "label": "Philippines",
      "code": "PH"
    },
    {
      "id": "country-PN",
      "label": "Pitcairn Islands",
      "code": "PN"
    },
    {
      "id": "country-PL",
      "label": "Poland",
      "code": "PL"
    },
    {
      "id": "country-PT",
      "label": "Portugal",
      "code": "PT"
    },
    {
      "id": "country-PR",
      "label": "Puerto Rico",
      "code": "PR"
    },
    {
      "id": "country-QA",
      "label": "Qatar",
      "code": "QA"
    },
    {
      "id": "country-RE",
      "label": "Réunion",
      "code": "RE"
    },
    {
      "id": "country-RO",
      "label": "Romania",
      "code": "RO"
    },
    {
      "id": "country-RU",
      "label": "Russia",
      "code": "RU"
    },
    {
      "id": "country-RW",
      "label": "Rwanda",
      "code": "RW"
    },
    {
      "id": "country-WS",
      "label": "Samoa",
      "code": "WS"
    },
    {
      "id": "country-SM",
      "label": "San Marino",
      "code": "SM"
    },
    {
      "id": "country-ST",
      "label": "São Tomé & Príncipe",
      "code": "ST"
    },
    {
      "id": "country-SA",
      "label": "Saudi Arabia",
      "code": "SA"
    },
    {
      "id": "country-SN",
      "label": "Senegal",
      "code": "SN"
    },
    {
      "id": "country-RS",
      "label": "Serbia",
      "code": "RS"
    },
    {
      "id": "country-SC",
      "label": "Seychelles",
      "code": "SC"
    },
    {
      "id": "country-SL",
      "label": "Sierra Leone",
      "code": "SL"
    },
    {
      "id": "country-SG",
      "label": "Singapore",
      "code": "SG"
    },
    {
      "id": "country-SX",
      "label": "Sint Maarten",
      "code": "SX"
    },
    {
      "id": "country-SK",
      "label": "Slovakia",
      "code": "SK"
    },
    {
      "id": "country-SI",
      "label": "Slovenia",
      "code": "SI"
    },
    {
      "id": "country-SB",
      "label": "Solomon Islands",
      "code": "SB"
    },
    {
      "id": "country-SO",
      "label": "Somalia",
      "code": "SO"
    },
    {
      "id": "country-ZA",
      "label": "South Africa",
      "code": "ZA"
    },
    {
      "id": "country-GS",
      "label": "South Georgia & South Sandwich Islands",
      "code": "GS"
    },
    {
      "id": "country-KR",
      "label": "South Korea",
      "code": "KR"
    },
    {
      "id": "country-SS",
      "label": "South Sudan",
      "code": "SS"
    },
    {
      "id": "country-ES",
      "label": "Spain",
      "code": "ES"
    },
    {
      "id": "country-LK",
      "label": "Sri Lanka",
      "code": "LK"
    },
    {
      "id": "country-BL",
      "label": "St. Barthélemy",
      "code": "BL"
    },
    {
      "id": "country-SH",
      "label": "St. Helena",
      "code": "SH"
    },
    {
      "id": "country-KN",
      "label": "St. Kitts & Nevis",
      "code": "KN"
    },
    {
      "id": "country-LC",
      "label": "St. Lucia",
      "code": "LC"
    },
    {
      "id": "country-MF",
      "label": "St. Martin",
      "code": "MF"
    },
    {
      "id": "country-PM",
      "label": "St. Pierre & Miquelon",
      "code": "PM"
    },
    {
      "id": "country-VC",
      "label": "St. Vincent & Grenadines",
      "code": "VC"
    },
    {
      "id": "country-SD",
      "label": "Sudan",
      "code": "SD"
    },
    {
      "id": "country-SR",
      "label": "Suriname",
      "code": "SR"
    },
    {
      "id": "country-SJ",
      "label": "Svalbard & Jan Mayen",
      "code": "SJ"
    },
    {
      "id": "country-SE",
      "label": "Sweden",
      "code": "SE"
    },
    {
      "id": "country-CH",
      "label": "Switzerland",
      "code": "CH"
    },
    {
      "id": "country-SY",
      "label": "Syria",
      "code": "SY"
    },
    {
      "id": "country-TW",
      "label": "Taiwan",
      "code": "TW"
    },
    {
      "id": "country-TJ",
      "label": "Tajikistan",
      "code": "TJ"
    },
    {
      "id": "country-TZ",
      "label": "Tanzania",
      "code": "TZ"
    },
    {
      "id": "country-TH",
      "label": "Thailand",
      "code": "TH"
    },
    {
      "id": "country-TL",
      "label": "Timor-Leste",
      "code": "TL"
    },
    {
      "id": "country-TG",
      "label": "Togo",
      "code": "TG"
    },
    {
      "id": "country-TK",
      "label": "Tokelau",
      "code": "TK"
    },
    {
      "id": "country-TO",
      "label": "Tonga",
      "code": "TO"
    },
    {
      "id": "country-TT",
      "label": "Trinidad & Tobago",
      "code": "TT"
    },
    {
      "id": "country-TN",
      "label": "Tunisia",
      "code": "TN"
    },
    {
      "id": "country-TR",
      "label": "Türkiye",
      "code": "TR"
    },
    {
      "id": "country-TM",
      "label": "Turkmenistan",
      "code": "TM"
    },
    {
      "id": "country-TC",
      "label": "Turks & Caicos Islands",
      "code": "TC"
    },
    {
      "id": "country-TV",
      "label": "Tuvalu",
      "code": "TV"
    },
    {
      "id": "country-UM",
      "label": "U.S. Outlying Islands",
      "code": "UM"
    },
    {
      "id": "country-VI",
      "label": "U.S. Virgin Islands",
      "code": "VI"
    },
    {
      "id": "country-UG",
      "label": "Uganda",
      "code": "UG"
    },
    {
      "id": "country-UA",
      "label": "Ukraine",
      "code": "UA"
    },
    {
      "id": "country-AE",
      "label": "United Arab Emirates",
      "code": "AE"
    },
    {
      "id": "country-GB",
      "label": "United Kingdom",
      "code": "GB"
    },
    {
      "id": "country-US",
      "label": "United States",
      "code": "US"
    },
    {
      "id": "country-UY",
      "label": "Uruguay",
      "code": "UY"
    },
    {
      "id": "country-UZ",
      "label": "Uzbekistan",
      "code": "UZ"
    },
    {
      "id": "country-VU",
      "label": "Vanuatu",
      "code": "VU"
    },
    {
      "id": "country-VA",
      "label": "Vatican City",
      "code": "VA"
    },
    {
      "id": "country-VE",
      "label": "Venezuela",
      "code": "VE"
    },
    {
      "id": "country-VN",
      "label": "Vietnam",
      "code": "VN"
    },
    {
      "id": "country-WF",
      "label": "Wallis & Futuna",
      "code": "WF"
    },
    {
      "id": "country-EH",
      "label": "Western Sahara",
      "code": "EH"
    },
    {
      "id": "country-YE",
      "label": "Yemen",
      "code": "YE"
    },
    {
      "id": "country-ZM",
      "label": "Zambia",
      "code": "ZM"
    },
    {
      "id": "country-ZW",
      "label": "Zimbabwe",
      "code": "ZW"
    }
  ]
};
