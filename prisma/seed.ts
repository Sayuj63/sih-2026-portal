import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { normalizeEmail, normalizeName, normalizeRollNumber } from "../src/lib/validation";
import { config } from "../src/lib/config";

const dbFile = config.databaseUrl.startsWith("file:") ? config.databaseUrl.slice(5) : config.databaseUrl;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbFile }) });

const COHORTS = [
  { batchYear: 2023, displayName: "Steve Jobs",       yearOfStudy: 4 },
  { batchYear: 2024, displayName: "Mark Zuckerberg",  yearOfStudy: 3 },
  { batchYear: 2025, displayName: "Sam Altman",       yearOfStudy: 2 },
  { batchYear: 2026, displayName: "Tim Cook",         yearOfStudy: 1 },
];

type SeedStudent = {
  batchYear: number;
  rollNumber: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  branch: string;
  section?: string;
};

const STUDENTS: SeedStudent[] = [
  // 2023 — Steve Jobs — 4th year
  { batchYear: 2023, rollNumber: "CSE001", fullName: "Aarav Sharma",     gender: "MALE",   branch: "CSE" },
  { batchYear: 2023, rollNumber: "CSE002", fullName: "Isha Verma",       gender: "FEMALE", branch: "CSE" },
  { batchYear: 2023, rollNumber: "CSE007", fullName: "Rohan Iyer",       gender: "MALE",   branch: "CSE" },
  { batchYear: 2023, rollNumber: "ECE003", fullName: "Priya Nair",       gender: "FEMALE", branch: "ECE" },
  { batchYear: 2023, rollNumber: "MEC004", fullName: "Vikram Menon",     gender: "MALE",   branch: "MEC" },
  { batchYear: 2023, rollNumber: "CSE010", fullName: "Sneha Reddy",      gender: "FEMALE", branch: "CSE" },
  { batchYear: 2023, rollNumber: "CSE011", fullName: "Karan Malhotra",   gender: "MALE",   branch: "CSE" },

  // 2024 — Mark Zuckerberg — 3rd year
  { batchYear: 2024, rollNumber: "CSE101", fullName: "Sayuj Pillai",     gender: "MALE",   branch: "CSE" },
  { batchYear: 2024, rollNumber: "CSE102", fullName: "Ananya Krishnan",  gender: "FEMALE", branch: "CSE" },
  { batchYear: 2024, rollNumber: "CSE107", fullName: "Devansh Rao",      gender: "MALE",   branch: "CSE" },
  { batchYear: 2024, rollNumber: "ECE105", fullName: "Meera Kapoor",     gender: "FEMALE", branch: "ECE" },
  { batchYear: 2024, rollNumber: "CSE110", fullName: "Aryan Chandra",    gender: "MALE",   branch: "CSE" },
  { batchYear: 2024, rollNumber: "AI115",  fullName: "Riya Bhatt",       gender: "FEMALE", branch: "AI" },
  { batchYear: 2024, rollNumber: "AI117",  fullName: "Kabir Anand",      gender: "MALE",   branch: "AI" },

  // 2025 — Sam Altman — 2nd year
  { batchYear: 2025, rollNumber: "CSE107", fullName: "Ishaan Deshmukh",  gender: "MALE",   branch: "CSE" }, // duplicates 2024/CSE107 across cohorts — legal
  { batchYear: 2025, rollNumber: "CSE201", fullName: "Aditi Bose",       gender: "FEMALE", branch: "CSE" },
  { batchYear: 2025, rollNumber: "CSE202", fullName: "Rahul Gupta",      gender: "MALE",   branch: "CSE" },
  { batchYear: 2025, rollNumber: "ECE203", fullName: "Neha Joshi",       gender: "FEMALE", branch: "ECE" },
  { batchYear: 2025, rollNumber: "MEC205", fullName: "Yash Kulkarni",    gender: "MALE",   branch: "MEC" },
  { batchYear: 2025, rollNumber: "AI210",  fullName: "Zara Khan",        gender: "FEMALE", branch: "AI" },
  { batchYear: 2025, rollNumber: "AI212",  fullName: "Aditya Rathi",     gender: "MALE",   branch: "AI" },

  // 2026 — Tim Cook — 1st year
  { batchYear: 2026, rollNumber: "CSE107", fullName: "Nitya Suri",       gender: "FEMALE", branch: "CSE" }, // duplicates roll across cohorts — legal
  { batchYear: 2026, rollNumber: "CSE301", fullName: "Ayaan Bakshi",     gender: "MALE",   branch: "CSE" },
  { batchYear: 2026, rollNumber: "CSE302", fullName: "Diya Chaturvedi",  gender: "FEMALE", branch: "CSE" },
  { batchYear: 2026, rollNumber: "ECE310", fullName: "Vivaan Saxena",    gender: "MALE",   branch: "ECE" },
  { batchYear: 2026, rollNumber: "AI320",  fullName: "Tara Ghosh",       gender: "FEMALE", branch: "AI" },
  { batchYear: 2026, rollNumber: "AI322",  fullName: "Om Prakash",       gender: "MALE",   branch: "AI" },
];

// Sample from official 2026 PS spread — themes reflect real SIH categories.
const PROBLEM_STATEMENTS = [
  { psNumber: "SIH-2026-1401", title: "AI-Powered Crop Disease Prediction Platform",             organization: "Ministry of Agriculture & Farmers Welfare", theme: "Agriculture, FoodTech & Rural Development", category: "Software" },
  { psNumber: "SIH-2026-1402", title: "IoT-based Smart Irrigation Advisory for Small Farms",     organization: "Ministry of Agriculture & Farmers Welfare", theme: "Agriculture, FoodTech & Rural Development", category: "Hardware" },
  { psNumber: "SIH-2026-1403", title: "Blockchain Land Record Verification Portal",              organization: "Ministry of Rural Development",             theme: "Blockchain & Cybersecurity",                  category: "Software" },
  { psNumber: "SIH-2026-1404", title: "Multilingual Ayushman Bharat Health Chatbot",             organization: "Ministry of Health & Family Welfare",        theme: "MedTech / BioTech / HealthTech",              category: "Software" },
  { psNumber: "SIH-2026-1405", title: "Wearable ECG Anomaly Detection for Rural Clinics",        organization: "Ministry of Health & Family Welfare",        theme: "MedTech / BioTech / HealthTech",              category: "Hardware" },
  { psNumber: "SIH-2026-1406", title: "Real-Time Flood Warning Using Satellite + Ground Sensors",organization: "Ministry of Earth Sciences",                theme: "Disaster Management",                          category: "Software" },
  { psNumber: "SIH-2026-1407", title: "AI Tutor for Regional-Language STEM Learning",            organization: "Ministry of Education",                     theme: "Smart Education",                              category: "Software" },
  { psNumber: "SIH-2026-1408", title: "Skill India Micro-Credential Verification Wallet",        organization: "Ministry of Skill Development",             theme: "Smart Education",                              category: "Software" },
  { psNumber: "SIH-2026-1409", title: "Traffic Signal Optimization via Reinforcement Learning",  organization: "Ministry of Road Transport & Highways",     theme: "Smart Vehicles & Transportation",              category: "Software" },
  { psNumber: "SIH-2026-1410", title: "EV Charging Station Load-Balancing Grid",                 organization: "Ministry of Power",                         theme: "Renewable/Sustainable Energy",                 category: "Software" },
  { psNumber: "SIH-2026-1411", title: "Rooftop Solar Yield Estimation from Satellite Imagery",   organization: "Ministry of New & Renewable Energy",        theme: "Renewable/Sustainable Energy",                 category: "Software" },
  { psNumber: "SIH-2026-1412", title: "Grievance Redressal Tracker for Municipal Services",      organization: "Ministry of Housing & Urban Affairs",       theme: "Smart Automation",                             category: "Software" },
  { psNumber: "SIH-2026-1413", title: "Deepfake Detection Toolkit for News Platforms",           organization: "Ministry of Electronics & IT",              theme: "Blockchain & Cybersecurity",                  category: "Software" },
  { psNumber: "SIH-2026-1414", title: "Braille Learning Companion for Visually Impaired",        organization: "Ministry of Social Justice & Empowerment",  theme: "Heritage & Culture",                           category: "Hardware" },
  { psNumber: "SIH-2026-1415", title: "Digital Preservation of Endangered Languages",            organization: "Ministry of Culture",                       theme: "Heritage & Culture",                           category: "Software" },
  { psNumber: "SIH-2026-1416", title: "Space Debris Trajectory Visualisation Tool",              organization: "Ministry of Science & Technology",          theme: "Space Technology",                             category: "Software" },
  { psNumber: "SIH-2026-1417", title: "AI Judging Assistant for Cultural Competitions",          organization: "Ministry of Culture",                       theme: "Heritage & Culture",                           category: "Software" },
  { psNumber: "SIH-2026-1418", title: "Water Quality Monitoring for River Cleaning Missions",    organization: "Ministry of Jal Shakti",                    theme: "Clean & Green Technology",                     category: "Hardware" },
  { psNumber: "SIH-2026-1419", title: "Fisheries Catch Reporting & Compliance App",              organization: "Ministry of Fisheries",                     theme: "Fitness & Sports",                             category: "Software" },
  { psNumber: "SIH-2026-1420", title: "Museum Artefact AR Storytelling Platform",                organization: "Ministry of Culture",                       theme: "Heritage & Culture",                           category: "Software" },
];

async function main() {
  console.log("Seeding SIH 2026 portal database…");

  const college = await prisma.college.upsert({
    where: { slug: config.college.slug },
    update: {
      name: config.college.name,
      emailDomain: config.college.emailDomain,
      timezone: config.college.timezone,
    },
    create: {
      slug: config.college.slug,
      name: config.college.name,
      emailDomain: config.college.emailDomain,
      timezone: config.college.timezone,
    },
  });
  console.log("  ✓ college");

  const cohortMap = new Map<number, string>();
  for (const c of COHORTS) {
    const row = await prisma.cohort.upsert({
      where: { collegeId_batchYear: { collegeId: college.id, batchYear: c.batchYear } },
      update: { displayName: c.displayName, yearOfStudy: c.yearOfStudy, isActive: true },
      create: {
        collegeId: college.id,
        batchYear: c.batchYear,
        displayName: c.displayName,
        yearOfStudy: c.yearOfStudy,
      },
    });
    cohortMap.set(c.batchYear, row.id);
  }
  console.log(`  ✓ ${COHORTS.length} cohorts`);

  for (const s of STUDENTS) {
    const cohortId = cohortMap.get(s.batchYear)!;
    const normalizedRoll = normalizeRollNumber(s.rollNumber);
    const emailLocal = `${s.fullName.split(" ")[0].toLowerCase()}.${normalizedRoll.toLowerCase()}`.replace(/[^a-z0-9.]/g, "");
    const rawEmail = `${emailLocal}@${config.college.emailDomain}`;
    const normalizedEmail = normalizeEmail(rawEmail);

    await prisma.student.upsert({
      where: {
        cohortId_normalizedRollNumber: { cohortId, normalizedRollNumber: normalizedRoll },
      },
      update: {
        fullName: s.fullName,
        normalizedName: normalizeName(s.fullName),
        rollNumber: s.rollNumber,
        collegeEmail: rawEmail,
        normalizedEmail,
        gender: s.gender,
        branch: s.branch,
        section: s.section ?? null,
      },
      create: {
        collegeId: college.id,
        cohortId,
        fullName: s.fullName,
        normalizedName: normalizeName(s.fullName),
        rollNumber: s.rollNumber,
        normalizedRollNumber: normalizedRoll,
        collegeEmail: rawEmail,
        normalizedEmail,
        gender: s.gender,
        branch: s.branch,
        section: s.section ?? null,
      },
    });
  }
  console.log(`  ✓ ${STUDENTS.length} students`);

  for (const p of PROBLEM_STATEMENTS) {
    const normalized = p.psNumber.trim().toUpperCase().replace(/\s+/g, "");
    await prisma.problemStatement.upsert({
      where: {
        collegeId_normalizedPsNumber: { collegeId: college.id, normalizedPsNumber: normalized },
      },
      update: {
        title: p.title,
        organization: p.organization,
        theme: p.theme,
        category: p.category,
        description: `${p.title} — issued by ${p.organization}.`,
        status: "ACTIVE",
      },
      create: {
        collegeId: college.id,
        psNumber: p.psNumber,
        normalizedPsNumber: normalized,
        title: p.title,
        organization: p.organization,
        theme: p.theme,
        category: p.category,
        description: `${p.title} — issued by ${p.organization}.`,
      },
    });
  }
  console.log(`  ✓ ${PROBLEM_STATEMENTS.length} problem statements`);

  const adminPasswordPlain = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe#SIH2026";
  const passwordHash = await hash(adminPasswordPlain);
  await prisma.admin.upsert({
    where: { collegeId_username: { collegeId: college.id, username: "spoc" } },
    update: { passwordHash, isActive: true, role: "SUPER_ADMIN", fullName: "SIH SPOC" },
    create: {
      collegeId: college.id,
      username: "spoc",
      fullName: "SIH SPOC",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`  ✓ admin seeded (username: spoc / password: ${adminPasswordPlain})`);

  // Deadline window (spec §106) initially open.
  await prisma.appSetting.upsert({
    where: { collegeId_key: { collegeId: college.id, key: "REGISTRATION_MODE" } },
    update: { value: "OPEN" },
    create: { collegeId: college.id, key: "REGISTRATION_MODE", value: "OPEN" },
  });

  console.log("\nDone. Log in as admin at /admin/login using the credentials above.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
