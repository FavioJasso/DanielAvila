/**
 * Daniel Avila's portfolio content — the single source of truth for every
 * course overlay, the plain HTML version, the pause menu and SEO metadata.
 *
 * Sources: the previous danielavila.tech site (copy kept verbatim where it
 * existed), "Resume - Daniel Avila.pdf", Daniel's GitHub project READMEs and
 * the Super Mario 64 hybrid blueprint's content mapping.
 *
 * Entries marked `needsReview: true` were drafted only from the blueprint's
 * wording (no detailed source existed) and should be confirmed or rewritten
 * by Daniel before launch. Nothing here invents employers, dates, grades or
 * results.
 */
import type { SectionId } from "@/game/contract";

export const SITE_URL = "https://www.danielavila.tech";

export const profile = {
  name: "Daniel Avila",
  firstName: "Daniel",
  lastName: "Avila",
  title: "Desktop Support Technician",
  tagline: "Simplifying Technology for People and Businesses",
  availability: "Available for opportunities",
  summary:
    "Passionate IT professional specializing in technical support, hardware troubleshooting, and streamlined system deployment solutions.",
  bio: [
    "I am Daniel Avila, a dedicated Desktop Support Technician with a passion for solving complex technical challenges and delivering exceptional IT support.",
    "Currently working at STORIS, Inc. and the County College of Morris IT Help Desk, I specialize in hardware troubleshooting, software installation, and providing reliable technical support to end-users.",
    "With hands-on experience in managing IT assets, resolving support tickets, and deploying systems, I strive to create efficient solutions that enhance productivity and user satisfaction.",
  ],
  highlights: [
    {
      title: "Technical Expertise",
      text: "Proficient in hardware repair, software installation, and multi-platform troubleshooting",
    },
    {
      title: "User-Focused Support",
      text: "Committed to delivering efficient solutions and exceptional service to diverse user groups",
    },
    {
      title: "Continuous Growth",
      text: "Always learning and adapting to new technologies and industry best practices",
    },
  ],
  careerFocus:
    "Building from hands-on desktop support toward cybersecurity: finishing an A.S. in Cyber Security at County College of Morris while studying for the CompTIA Security+ and Red Hat Certified System Administrator certifications.",
  location: "New Jersey, USA",
  email: "danielavila.office@gmail.com",
  phone: "(973) 975-8687",
  phoneHref: "tel:+19739758687",
  photo: { src: "/daniel-avila.jpg", width: 720, height: 690, alt: "Daniel Avila" },
  links: {
    linkedin: "https://www.linkedin.com/in/danielavila2/",
    github: "https://github.com/Happie04",
    resume: "/Resume - Daniel Avila.pdf",
  },
  resumeFileName: "Resume - Daniel Avila.pdf",
  contactPrompt:
    "Have a project in mind or need IT support? Let's discuss how I can help bring your ideas to life.",
} as const;

/** EmailJS configuration carried over from the previous site's contact form. */
export const contactForm = {
  serviceId: "service_epaw1g5",
  templateId: "template_xgiobnl",
  publicKey: "O7IxMgPavA6zaZ2Mq",
  /** Field `name` attributes the EmailJS template expects. */
  fields: { name: "from_name", email: "from_email", message: "message" },
  placeholders: {
    name: "Your Name",
    email: "Your Email",
    message: "Tell me about your project or inquiry...",
  },
  success: "Message sent successfully!",
  failure: "Failed to send message. Please try again.",
} as const;

export const credits = {
  copyright: "© 2025 Daniel Avila. All rights reserved.",
  role: "Desktop Support Technician | IT Professional",
  builtBy: { label: "Camino Code", href: "https://www.caminocode.com/", logo: "/footer-logo.png" },
  builtByPrefix: "Crafted with excellence by:",
  brandMark: { src: "/blue-whale.png", alt: "Daniel Avila" },
} as const;

/* ------------------------------------------------------------------ */
/* Course 1 — Education                                                 */
/* ------------------------------------------------------------------ */

export interface CourseworkCard {
  id: string;
  title: string;
  blurb: string;
  topics: string[];
  needsReview?: boolean;
}

export const education = {
  institution: "County College of Morris",
  location: "Randolph, New Jersey",
  degree: "A.S. in Cyber Security & Certificate of Information Security",
  status: "Expected graduation: Fall 2026",
  logo: { src: "/ccm-logo.png", alt: "County College of Morris Logo" },
  milestones: [
    "Microsoft Office Specialist – Associate (MOS), achieved May 2023",
    "ISC2 CC course completion",
    "Currently studying for the CompTIA Security+ certificate and the Red Hat Certified System Administrator certificate",
    "Led a team of 5 IT interns at the County College of Morris IT Help Desk",
  ],
  coursework: [
    {
      id: "infosec",
      title: "Information Security",
      blurb: "Core security practice for protecting systems and the people who use them.",
      topics: ["Network security controls", "Incident handling", "Change management"],
      needsReview: true,
    },
    {
      id: "forensics",
      title: "Computer Forensics",
      blurb: "Handling digital evidence carefully from collection through reporting.",
      topics: ["Digital evidence processing", "Incident response"],
      needsReview: true,
    },
    {
      id: "sql",
      title: "Database Management (SQL)",
      blurb: "Designing relational databases and writing the SQL that runs them.",
      topics: ["SQL DDL / DML", "Schema design", "Query optimization"],
      needsReview: true,
    },
    {
      id: "math",
      title: "Mathematics",
      blurb: "The quantitative foundation behind the Cyber Security degree.",
      topics: ["Problem solving", "Logical reasoning"],
      needsReview: true,
    },
  ] satisfies CourseworkCard[],
} as const;

/* ------------------------------------------------------------------ */
/* Course 2 — Skills                                                    */
/* ------------------------------------------------------------------ */

export interface SkillGroup {
  id: string;
  title: string;
  items: string[];
}

export const skillGroups: SkillGroup[] = [
  {
    id: "security",
    title: "Security & Forensics",
    items: [
      "Incident handling",
      "Digital evidence processing",
      "Network security controls",
      "Change management",
    ],
  },
  {
    id: "data",
    title: "Data & Programming",
    items: ["SQL DDL / DML", "Schema design", "Query optimization"],
  },
  {
    id: "hardware",
    title: "Hardware & Networking",
    items: [
      "Hardware installation & repair",
      "Computer diagnostics",
      "BIOS configuration",
      "Operating system installation",
      "Wi-Fi & VPN connectivity",
      "Multi-platform troubleshooting (Windows, Mac, Linux, iOS, Android)",
      "IT asset & inventory management",
      "3D printing hardware",
    ],
  },
  {
    id: "software",
    title: "Software & Tools",
    items: [
      "Software installation",
      "Microsoft Suite",
      "Adobe Premiere & Photoshop",
      "Onshape",
      "Cura",
      "Google Analytics",
      "OBS",
    ],
  },
  {
    id: "languages",
    title: "Languages",
    items: ["English", "Spanish"],
  },
];

/* ------------------------------------------------------------------ */
/* Course 3 — Career & Labs ("Star Missions")                           */
/* ------------------------------------------------------------------ */

export interface Job {
  id: string;
  company: string;
  role: string;
  type: string;
  location: string;
  period: string;
  summary: string;
  bullets: string[];
  logo: { src: string; alt: string };
}

export const jobs: Job[] = [
  {
    id: "storis",
    company: "STORIS, Inc.",
    role: "Desktop Support Technician",
    type: "Part time",
    location: "Mt. Arlington, New Jersey",
    period: "July 2025 – Present",
    summary:
      "Install software and hardware on new laptops, manage IT inventory, resolve employee support tickets, and deploy laptops to remote staff",
    bullets: [
      "Managed an in-house ticketing system and actively assisted over 150 fellow employees in office and remote.",
      "Troubleshooting software and hardware issues with laptops, PCs, phones, VPNs, Windows OS, Mac OS, and other in-house applications, allowing employees to continue efficiently working without problems.",
      "Installed operating systems, configured BIOS, updated Windows and other software, and optimized performance on employee hardware.",
      "Performed system testing, upgrades, and maintenance, reinforcing hands-on experience with diagnostics and repair.",
    ],
    logo: { src: "/storis-logo.png", alt: "STORIS Logo" },
  },
  {
    id: "ccm",
    company: "County College of Morris",
    role: "Information Technology Help Desk",
    type: "Part time",
    location: "Randolph, New Jersey",
    period: "January 2025 – Present",
    summary:
      "Troubleshoot devices (Windows, Mac, Linux, iOS, Android), support campus software, and assist with Wi-Fi/VPN connectivity",
    bullets: [
      "Troubleshooting computer and mobile device issues (Windows, Mac, Linux, iOS, Android), assisting over 100+ users across the college.",
      "Help with installing and troubleshooting software (e.g., Microsoft Office, Adobe Suite, Blackboard, etc.).",
      "Assistance with connecting to the campus Wi-Fi and Virtual Machine Software.",
      "Collaborated with cross-functional teams across administration and Information Systems.",
      "Led a team of 5 IT interns in solving troubleshooting / IT related problems.",
    ],
    logo: { src: "/ccm-logo.png", alt: "County College of Morris Logo" },
  },
];

export interface Mission {
  id: string;
  /** Star number shown on the mission tab. */
  star: number;
  title: string;
  kind: "lab" | "experience" | "project";
  kindLabel: string;
  objective: string;
  tools: string[];
  outcome: string;
  /** Extra bullet points under the outcome. */
  bullets?: string[];
  /** Tags shown as chips (kept from the previous site's project cards). */
  tags?: string[];
  links?: { label: string; href: string }[];
  /** Render the `jobs` list inside this mission. */
  showJobs?: boolean;
  /** Spec sheet rows (label → value). */
  specs?: { label: string; value: string }[];
  needsReview?: boolean;
}

export const missions: Mission[] = [
  {
    id: "sql-database",
    star: 1,
    title: "Enterprise SQL Database Implementation",
    kind: "lab",
    kindLabel: "Technical lab",
    objective:
      "Design and implement a relational database the way an enterprise team would: plan the schema first, then build it and query it with SQL.",
    tools: ["SQL (DDL / DML)", "Schema design", "Query optimization"],
    outcome:
      "Hands-on practice defining tables and relationships, loading and changing data, and tuning queries.",
    needsReview: true,
  },
  {
    id: "forensics-lab",
    star: 2,
    title: "Forensic Evidence & Incident Response Lab",
    kind: "lab",
    kindLabel: "Technical lab",
    objective:
      "Work a security incident from first report to documented evidence, following careful handling procedures at each step.",
    tools: [
      "Incident handling",
      "Digital evidence processing",
      "Network security controls",
      "Change management",
    ],
    outcome:
      "Hands-on practice processing digital evidence and responding to an incident in a controlled lab setting.",
    needsReview: true,
  },
  {
    id: "experience",
    star: 3,
    title: "Professional Experience",
    kind: "experience",
    kindLabel: "Work experience",
    objective:
      "Keep people working: resolve hardware and software problems quickly for employees, students and staff, in the office and remote.",
    tools: [
      "Ticketing system",
      "Windows OS",
      "Mac OS",
      "Linux",
      "iOS & Android",
      "VPN & Wi-Fi",
      "BIOS configuration",
      "Microsoft Office",
      "Adobe Suite",
      "Blackboard",
    ],
    outcome:
      "Supporting 150+ employees at STORIS, Inc. and 100+ users at the County College of Morris, and leading a team of 5 IT interns.",
    showJobs: true,
  },
  {
    id: "pc-build",
    star: 4,
    title: "June 2025 High-Performance PC Build",
    kind: "project",
    kindLabel: "Personal project",
    objective:
      "Custom-built workstation featuring AMD Ryzen 9 9900X and Radeon RX 9070XT, optimized for consulting, testing, OS upgrades, and professional software installation. Includes full specs, build photos, and technician services.",
    tools: ["Hardware selection & assembly", "BIOS configuration", "Windows 10 & 11", "Driver & software setup"],
    outcome:
      "Complete technician work for a client build: consulting, building, testing, OS upgrade, software installation and updates, and BIOS configuration.",
    bullets: [
      "Built and configured custom desktop PCs, gaining hands-on experience with hardware installation and troubleshooting.",
      "Diagnosed software and OS issues, applying problem-solving skills relevant to ticket-based support.",
      "Installed and maintained Windows OS and applications, aligning with business software administration tasks.",
      "Managed personal hardware inventory and upgrades, mirroring equipment and facility support duties.",
      "Configured BIOS, drivers, and peripherals, supporting new device setup and user readiness.",
      "Resolved system performance issues independently, demonstrating skills in hardware/software diagnostics.",
    ],
    tags: [
      "Consulting & Technical Services",
      "Hardware Selection & Assembly",
      "System Configuration (BIOS, OS, Software)",
    ],
    specs: [
      { label: "OS", value: "Windows 10 & 11" },
      { label: "CPU", value: "AMD Ryzen 9 9900X" },
      { label: "GPU", value: "AMD Radeon RX 9070XT (16GB)" },
      { label: "Motherboard", value: "X670E MAG Tomahawk AM5 ATX" },
      { label: "RAM", value: "32GB DDR5 4800MHz" },
      { label: "Storage", value: "2TB M.2 SSD | 256GB SATA SSD" },
      { label: "CPU cooler", value: "RGB 360mm AIO liquid cooling" },
      { label: "PSU", value: "850W Gold, fully modular" },
      { label: "Case", value: "Montech XR Mid-Tower" },
      { label: "Wireless", value: "Wi-Fi / Bluetooth compatible" },
    ],
    links: [{ label: "View details on GitHub", href: "https://github.com/Happie04/June-2025-PC-Build" }],
  },
  {
    id: "3d-printing",
    star: 5,
    title: "3D Printing Projects – Custom CAD Models & Prints",
    kind: "project",
    kindLabel: "Personal project",
    objective:
      "Collection of 3D-printed projects including video game characters, coasters, and gadgets. Designed from scratch in OnShape, optimized in Cura, and printed on an Ender 3 V2 Pro with premium filament for durable, high-quality results.",
    tools: ["OnShape", "Cura", "Ender 3 V2 Pro", "Premium eSun filament"],
    outcome:
      "Precise CAD models, tuned print settings and durable, high-quality finished prints — including a 6-inch-tall video game character model designed from scratch (September – October 2024).",
    bullets: [
      "Utilized CAD-OnShape to design the model from scratch, ensuring precision and accuracy for successful printing.",
      "Optimized the model for 3D printing using Cura, including layer adjustments, material settings, and supports for structural integrity.",
      "Operated an Ender 3 V2 Pro printer with premium eSun filament to achieve a high-quality, durable finish.",
    ],
    tags: [
      "OnShape (CAD Modeling)",
      "Cura (Slicing & Print Optimization)",
      "Ender 3 V2 Pro (3D Printing Hardware)",
    ],
    links: [{ label: "View details on GitHub", href: "https://github.com/Happie04/3D-Printing-Projects" }],
  },
];

/* ------------------------------------------------------------------ */
/* Course 4 — Certifications                                            */
/* ------------------------------------------------------------------ */

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  status: "completed" | "in-progress";
  statusLabel: string;
  /** Shown as a VERIFIED badge on the previous site. */
  verified?: boolean;
  date?: string;
  description: string;
  competencies: string[];
  logo?: { src: string; alt: string };
  /** Only set when a real verification URL exists. */
  verifyUrl?: string;
}

export const certifications: Certification[] = [
  {
    id: "mos",
    name: "Microsoft Office Specialist Certification",
    issuer: "Microsoft",
    status: "completed",
    statusLabel: "Completed",
    verified: true,
    date: "May 2023",
    description:
      "Professional certification demonstrating advanced expertise in Microsoft Office applications, and essential workplace software solutions for modern businesses.",
    competencies: [
      "Word, Excel and PowerPoint",
      "Creating and formatting documents",
      "Formulas and functions in Excel",
      "Designing professional presentations",
    ],
    logo: { src: "/microsoft-logo.png", alt: "Microsoft" },
  },
  {
    id: "adda",
    name: "Apprentice Drafter",
    issuer: "American Design Drafting Association",
    status: "completed",
    statusLabel: "Completed",
    verified: true,
    description:
      "Professional certification in technical drafting and design, demonstrating proficiency in CAD software and technical drawing standards.",
    competencies: ["Technical drafting and design", "CAD software", "Technical drawing standards"],
    logo: { src: "/adda-logo.png", alt: "ADDA Logo" },
  },
  {
    id: "isc2-cc",
    name: "ISC2 CC",
    issuer: "ISC2",
    status: "completed",
    statusLabel: "Course completed",
    description: "Completion of the ISC2 CC (Certified in Cybersecurity) course.",
    competencies: ["Security principles", "Network security", "Incident response"],
  },
  {
    id: "security-plus",
    name: "CompTIA Security+",
    issuer: "CompTIA",
    status: "in-progress",
    statusLabel: "In progress",
    description: "Currently studying for the CompTIA Security+ certificate.",
    competencies: ["Threats and vulnerabilities", "Security operations", "Risk management"],
  },
  {
    id: "rhcsa",
    name: "Red Hat Certified System Administrator",
    issuer: "Red Hat",
    status: "in-progress",
    statusLabel: "In progress",
    description: "Currently studying for the Red Hat Certified System Administrator certificate.",
    competencies: ["Linux system administration", "Users and permissions", "Storage and services"],
  },
];

/* ------------------------------------------------------------------ */
/* Section index (pause menu, plain version nav, sitemap)               */
/* ------------------------------------------------------------------ */

export interface SectionMeta {
  id: SectionId;
  /** Anchor id in the plain HTML version. */
  anchor: string;
  navLabel: string;
  heading: string;
  intro: string;
}

export const sections: SectionMeta[] = [
  {
    id: "education",
    anchor: "education",
    navLabel: "Education",
    heading: "Academic Foundation",
    intro: "Degree, institution, milestones and coursework.",
  },
  {
    id: "skills",
    anchor: "skills",
    navLabel: "Skills",
    heading: "Technical Arsenal",
    intro: "Security, data, hardware and software skills.",
  },
  {
    id: "career",
    anchor: "experience",
    navLabel: "Career & Labs",
    heading: "Experience & Technical Projects",
    intro: "Work experience, technical labs and personal projects.",
  },
  {
    id: "certifications",
    anchor: "certification",
    navLabel: "Certifications",
    heading: "Credentials & Badges",
    intro: "Completed and in-progress certifications.",
  },
  {
    id: "about",
    anchor: "contact",
    navLabel: "About & Contact",
    heading: "Player Profile & Comms",
    intro: "Bio, career focus, contact links and the PDF résumé.",
  },
];
