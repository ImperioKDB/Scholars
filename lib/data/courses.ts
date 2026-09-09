// Curated list of common Nigerian degree/ND/NCE course titles. The source
// literal stays grouped by faculty (matches JAMB's brochure and is easier
// to extend), but the exported COURSES array is sorted alphabetically so
// the student discipline combobox and the admin rule builder both read
// A-Z instead of faculty order.
const COURSE_LIST: string[] = [
  // Administration & Management
  "Accounting","Actuarial Science","Banking and Finance","Business Administration","Business Education","Cooperative and Rural Development","Entrepreneurship","Human Resource Management","Insurance","Local Government Administration","Management","Marketing","Office Technology and Management","Public Administration","Taxation","Transport Management",
  // Agriculture
  "Agricultural Economics","Agricultural Engineering","Agricultural Extension and Rural Development","Animal Science","Aquaculture and Fisheries Management","Crop Science","Food Science and Technology","Forestry and Wildlife Management","Home Science and Management","Soil Science","Veterinary Medicine",
  // Arts & Humanities
  "Arabic and Islamic Studies","Archaeology","Christian Religious Studies","English Language","French","German","Fine and Applied Arts","History and International Studies","Igbo Language","Hausa Language","Yoruba Language","Linguistics","Music","Philosophy","Religious Studies","Theatre and Film Studies",
  // Education
  "Adult Education","Agricultural Education","Biology Education","Chemistry Education","Computer Science Education","Early Childhood Education","Economics Education","English Education","Guidance and Counselling","Health Education","Home Economics Education","Mathematics Education","Physical and Health Education","Physics Education","Political Science Education","Primary Education Studies","Special Education","Vocational and Technical Education",
  // Engineering, Environment & Technology
  "Agricultural and Bio-Resources Engineering","Architecture","Building Technology","Chemical Engineering","Civil Engineering","Computer Engineering","Electrical/Electronics Engineering","Environmental Management","Estate Management","Industrial Design","Marine Engineering","Mechanical Engineering","Mechatronics Engineering","Metallurgical and Materials Engineering","Petroleum Engineering","Petroleum and Gas Engineering","Quantity Surveying","Surveying and Geoinformatics","Textile Science and Technology","Urban and Regional Planning",
  // Law
  "Law","International Law and Diplomacy","Islamic Law (Sharia)",
  // Medical, Pharmaceutical & Health Sciences
  "Anatomy","Dentistry","Environmental Health Science","Human Nutrition and Dietetics","Medical Laboratory Science","Medicine and Surgery","Nursing Science","Optometry","Pharmacy","Physiology","Physiotherapy","Public Health","Radiography",
  // Sciences
  "Biochemistry","Biology","Botany","Chemistry","Computer Science","Cyber Security","Data Science","Geology","Industrial Chemistry","Information Technology","Microbiology","Marine Biology","Mathematics","Meteorology","Physics","Software Engineering","Statistics","Zoology",
  // Social & Management Sciences
  "Criminology and Security Studies","Demography and Social Statistics","Economics","Geography","International Relations","Library and Information Science","Mass Communication","Peace Studies and Conflict Resolution","Political Science","Psychology","Social Work","Sociology",
];

export const COURSES: string[] = [...COURSE_LIST].sort((a, b) => a.localeCompare(b));

export const COURSE_OPTIONS = COURSES.map((c) => ({ value: c, label: c }));
