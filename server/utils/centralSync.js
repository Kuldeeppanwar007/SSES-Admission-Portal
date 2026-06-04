const axios = require('axios');

const MOCK_MODE = process.env.CENTRAL_MOCK_MODE === 'true';

// ── SQL Safety ───────────────────────────────────────────────────────────────
// Central stores in SQL DB — strip dangerous patterns from free-text fields
const sanitizeSqlUnsafe = (val) => {
  if (!val) return null;
  return val
    .replace(/'/g, '')           // single quotes
    .replace(/--/g, '')          // SQL comments
    .replace(/;/g, '')           // statement terminators
    .replace(/\\/g, '')          // backslashes
    .replace(/xp_/gi, '')        // SQL Server extended procs
    .replace(/exec\s/gi, '')     // exec commands
    .replace(/UNION\s+SELECT/gi, '')  // union injection
    .replace(/DROP\s+TABLE/gi, '')    // drop table
    .replace(/DELETE\s+FROM/gi, '')   // delete injection
    .replace(/INSERT\s+INTO/gi, '')   // insert injection
    .replace(/UPDATE\s+.*SET/gi, '')  // update injection
    .replace(/OR\s+1\s*=\s*1/gi, '') // boolean injection
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // XSS
    .replace(/[<>]/g, '')        // HTML tags
    .trim() || null;
};

// ── Normalizers ──────────────────────────────────────────────────────────────
// Central expects exact case-sensitive values — map our DB values to Central's

// Category: Central expects "GEN", "OBC", "SC", "ST"
const CATEGORY_MAP = {
  'gen': 'GEN', 'general': 'GEN',
  'obc': 'OBC', 'obc-ncl': 'OBC', 'obcncl': 'OBC',
  'sc': 'SC', 'sc/st': 'SC',
  'st': 'ST',
};
const normalizeCategory = (val) => {
  if (!val) return null;
  const key = val.trim().toLowerCase().replace(/[^a-z/-]/g, '');
  // Central only accepts GEN/OBC/SC/ST — return null for unknown values
  return CATEGORY_MAP[key] || null;
};

// Gender: Central expects "male", "female"
const normalizeGender = (val) => {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  if (lower === 'male' || lower === 'm') return 'male';
  if (lower === 'female' || lower === 'f') return 'female';
  if (lower === 'other') return 'Other'; // Central also allows "Other"
  return null;
};

// school12Sub: Central expects "Maths", "BIO", "Art", "Commerce", "Agriculture"
const SCHOOL12SUB_MAP = {
  'maths': 'Maths', 'math': 'Maths', 'pcm': 'Maths', 'science': 'Maths',
  'maths science': 'Maths', 'pcm maths': 'Maths',
  'bio': 'BIO', 'biology': 'BIO', 'bioloy': 'BIO', 'pcb': 'BIO',
  'bio maths': 'BIO', 'bio +maths': 'BIO',
  'art': 'Art', 'arts': 'Art',
  'commerce': 'Commerce', 'commere': 'Commerce', 'commerece': 'Commerce',
  'com': 'Commerce', "com. + math's": 'Commerce', 'bcom': 'Commerce',
  'agriculture': 'Agriculture', 'agri': 'Agriculture',
};
const normalizeSchool12Sub = (val) => {
  if (!val) return null;
  const key = val.trim().toLowerCase().replace(/\s+/g, ' ');
  return SCHOOL12SUB_MAP[key] || sanitizeSqlUnsafe(val.trim()) || null;
};

// trackName (Bus Track): Central expects exact case — 10 values
const CENTRAL_TRACKS = [
  'Harda', 'Kannod', 'Khategaon', 'Narmadapuram', 'Nasrullaganj',
  'Nemawar', 'Rehti', 'Sandalpur', 'Satwas', 'Seoni-Malwa',
];
// Sub-town → Central track mapping (for towns not directly in Central's list)
const TOWN_TO_CENTRAL_TRACK = {
  'timarni': 'Harda', 'seoni malwa': 'Seoni-Malwa', 'seoni-malwa': 'Seoni-Malwa',
  'satwas & kannod': 'Satwas', 'satwas and kannod': 'Satwas', 'satwas kannod': 'Satwas',
  'gopalpur': 'Rehti', 'bherunda': 'Rehti', 'betuler': null,
  'borkheda': null, 'other': null,
  // Sub-towns that map to known tracks
  'atraliya': 'Satwas', 'akawliya': 'Harda', 'ameli': 'Rehti',
  'kolari khidkiya': null, 'tiladiya': null,
};
const normalizeTrackName = (val) => {
  if (!val) return null;
  const trimmed = val.trim();
  // Exact match (case-insensitive) against Central's 10 tracks
  const exactMatch = CENTRAL_TRACKS.find(t => t.toLowerCase() === trimmed.toLowerCase());
  if (exactMatch) return exactMatch;
  // Sub-town mapping
  const key = trimmed.toLowerCase();
  if (TOWN_TO_CENTRAL_TRACK[key] !== undefined) return TOWN_TO_CENTRAL_TRACK[key];
  // Fallback — sanitize for Central's regex pattern /^[a-zA-Z0-9\s-]+$/ + SQL safety
  return sanitizeSqlUnsafe(trimmed.replace(/[^a-zA-Z0-9\s-]/g, '').trim()) || null;
};

// Branch: Central expects exact values
// General: "B.com(CA)", "BBA", "BCA", "BSC(BT)", "BSC(Micro)", "ITEG Diploma"
// BTech:   "B.Tech(AIML)", "B.Tech(CS)", "B.Tech(ECE)", "B.Tech(IT)"
const BRANCH_MAP = {
  // BTech aliases
  'cs': 'B.Tech(CS)', 'b.tech(cs)': 'B.Tech(CS)', 'b.tech (cs)': 'B.Tech(CS)',
  'it': 'B.Tech(IT)', 'b.tech(it)': 'B.Tech(IT)', 'b.tech (it)': 'B.Tech(IT)',
  'aiml': 'B.Tech(AIML)', 'ai/ml': 'B.Tech(AIML)', 'b.tech(aiml)': 'B.Tech(AIML)',
  'b.tech(ai/ml)': 'B.Tech(AIML)', 'b.tech (aiml)': 'B.Tech(AIML)',
  'ece': 'B.Tech(ECE)', 'b.tech(ece)': 'B.Tech(ECE)', 'b.tech (ece)': 'B.Tech(ECE)',
  // General aliases
  'bca': 'BCA', 'bca(iteg)': 'BCA',
  'bba': 'BBA',
  'bsc(bt)': 'BSC(BT)', 'bsc(bio)': 'BSC(BT)', 'bio': 'BSC(BT)',
  'bsc(micro)': 'BSC(Micro)', 'bsc(micr)': 'BSC(Micro)', 'micro': 'BSC(Micro)',
  'b.com(ca)': 'B.com(CA)', 'b.com (ca)': 'B.com(CA)', 'bcom': 'B.com(CA)', 'bcom(ca)': 'B.com(CA)',
  'iteg diploma': 'ITEG Diploma', 'iteg': 'ITEG Diploma',
};
const normalizeBranch = (val) => {
  if (!val) return null;
  const key = val.trim().toLowerCase();
  return BRANCH_MAP[key] || sanitizeSqlUnsafe(val.trim());
};

// Village: Central has 170 exact values — case-sensitive match, fallback "other"
const CENTRAL_VILLAGES = new Set([
  'Agarda', 'Ajnas', 'Akawliya', 'Ameli', 'Atraliya', 'Atwas', 'Awalighat',
  'Bachkhal', 'Bagda', 'Bagwada', 'Baisad', 'Bajgaon', 'Bajwada', 'Balagaon',
  'Bamangaon', 'Bamni', 'Bamori Harda', 'Banya ( Rehti )', 'Bapcha', 'Barawai',
  'Barcha', 'Barkhedi', 'Baroda (Satwas)', 'Barvai Kheda', 'Barwai', 'Bedgaon',
  'Bedi', 'Besva', 'Bhamori', 'Bhandariya', 'Bhatasa', 'Bhilkhedi', 'Bijalgaon',
  'Bijapur', 'Borda', 'Borkheda', 'Borkhedi', 'Chakaldi', 'Chandaghran', 'Chandwana',
  'Charkheda', 'Chhipaner', 'Chinch', 'Chorsakhedi', 'Choti Barcha', 'Choti-Harda',
  'Cichlaykala', 'Dabri', 'Dabri Satwas', 'Deepgaon', 'Devla', 'Dewas', 'Dhandiya',
  'Dhayli', 'Dheriya', 'Dholpur', 'Dipgaon', 'Dulwa', 'Eklera', 'Ghutwani', 'Gilhari',
  'Gopalpur', 'Gujargaon', 'Gulerpura', 'Gunnas', 'Handiya', 'Harangaon', 'Harda',
  'Itava-khurd', 'Itawa Itarsi', 'Jamner', 'Janjalkhedi', 'Jiyagaon', 'Kakadkui',
  'Kakriya', 'Kalafata', 'Kalwar', 'Kannod', 'Kantafod', 'Katafode', 'Katkut',
  'Kavlasa', 'Khal', 'Kharda', 'Khariya', 'Kharsaniya', 'Khategaon', 'Khedi',
  'Khedi Panigaon', 'Kiloda', 'Kolari', 'Kothmeer', 'Kothmir', 'Kumantal',
  'Kuri Nayapura', 'Ladkui', 'Lavras', 'Lawras', 'Loharda', 'Magariya', 'Mahagaon',
  'Malagaon', 'Malsagoda', 'Mangrul', 'Masangaon', 'Mohai', 'murjhal', 'Namawar',
  'Nanasa', 'Nandgaon', 'Narayadpura', 'Narayanpura', 'Nasrullaganj', 'Navalgaon',
  'Nemawar', 'Nilkanth', 'Nimgaon', 'Nimota', 'Nipaniya', 'Olamba', 'other',
  'Pachor', 'Paldiya', 'Pipalda', 'pipalkota', 'Piplani', 'Pipliya barkhedi',
  'PiplyaNanker', 'Rahatgaon', 'Rala', 'Ramgada', 'Ramnagar', 'Rata Talai',
  'Rehmanpura', 'Rehti', 'Richi', 'Rijgaon', 'Samya', 'Sandalpur', 'Satrana',
  'Satwas', 'Sawasada', 'Sawasadi', 'Sawasda', 'Semalpani', 'Sherguna', 'Shyampur',
  'Sigaon', 'Silfodekheda', 'Sivani Malwa', 'soyat', 'Tajpura', 'Timarni',
  'Tivdiya', 'Uda', 'Umriya', 'Utavliya', 'Vasudev', 'Vikrampur',
]);
// Case-insensitive lookup map for fuzzy matching
const VILLAGE_LOWER_MAP = {};
CENTRAL_VILLAGES.forEach(v => { VILLAGE_LOWER_MAP[v.toLowerCase().trim()] = v; });

const normalizeVillage = (val) => {
  if (!val) return null;
  const trimmed = val.trim();
  // Exact match
  if (CENTRAL_VILLAGES.has(trimmed)) return trimmed;
  // Case-insensitive match
  const matched = VILLAGE_LOWER_MAP[trimmed.toLowerCase()];
  if (matched) return matched;
  // Not found → "other"
  return 'other';
};

// ── Pre-Sync Validation ─────────────────────────────────────────────────────
// Sync karne se pehle check karo ki required fields hain ya nahi
// Central 400 dega agar ye missing hain — better to catch early

const validateForSsismSync = (payload) => {
  const missing = [];
  if (!payload.firstName) missing.push('firstName');
  if (!payload.lastName) missing.push('lastName');
  if (!payload.fathersName) missing.push('fathersName');
  if (!payload.mobile) missing.push('mobile');
  if (!payload.fatherContactNumber) missing.push('fatherContactNumber');
  if (!payload.village) missing.push('village');
  if (!payload.category) missing.push('category');
  if (!payload.address) missing.push('address');
  if (!payload.schoolName) missing.push('schoolName');
  if (!payload.school12Sub) missing.push('school12Sub');
  if (payload.persentage10 == null && payload.persentage10 !== 0) missing.push('persentage10');
  return missing;
};

const validateForBtechSync = (payload) => {
  const missing = [];
  if (!payload.firstName) missing.push('firstName');
  if (!payload.lastName) missing.push('lastName');
  if (!payload.mobile) missing.push('mobile');
  if (!payload.email) missing.push('email');
  if (!payload.fathersName) missing.push('fathersName');
  if (!payload.fatherContactNumber) missing.push('fatherContactNumber');
  if (!payload.schoolName) missing.push('schoolName');
  if (!payload.branch) missing.push('branch');
  if (!payload.address) missing.push('address');
  return missing;
};

// ── Payload Builders ─────────────────────────────────────────────────────────

// Student model se SSISM (new_student_reg) payload banao
const buildSsismPayload = (s) => ({
  id: s.externalId || null,
  firstName: sanitizeSqlUnsafe((s.name || '').split(' ')[0]) || null,
  lastName: sanitizeSqlUnsafe((s.name || '').split(' ').slice(1).join(' ')) || null,
  fathersName: sanitizeSqlUnsafe(s.fatherName),
  mobile: String(s.mobileNo) || null,
  email: sanitizeSqlUnsafe(s.email) || String('self-mkt' + Date.now() + '@ssism.org'),
  branch: normalizeBranch(s.branch),
  year: s.year || 'I',
  joinBatch: s.joinBatch || new Date().getFullYear(),
  feesScheme: s.feesScheme || null,
  dob: s.dob || null,
  fatherContactNumber: String(s.fatherContactNumber) || String(s.mobileNo),
  schoolName: sanitizeSqlUnsafe(s.schoolName),
  school12Sub: normalizeSchool12Sub(s.school12Sub) || 'Maths',
  rollNumber12: s.rollNumber12 || null,
  persentage12: s.persentage12 || null,
  persentage11: s.persentage11 || null,
  persentage10: s.persentage10 != null ? s.persentage10 : null,
  rollNumber10: s.rollNumber10 || null,
  aadharNo: s.aadharNo || null,
  fatherOccupation: sanitizeSqlUnsafe(s.fatherOccupation),
  fatherIncome: s.fatherIncome || null,
  category: normalizeCategory(s.category),
  gender: normalizeGender(s.gender),
  pincode: s.pincode || null,
  trackName: normalizeTrackName(s.trackName),
  address: sanitizeSqlUnsafe(s.fullAddress),
  village: normalizeVillage(s.village),
  tehsil: s.tehsil || null,
  district: s.district || null,
  regFees: s.regFees || null,
  regFeesStatus: s.regFeesStatus || 'Unpaid',
  accRegFeesStatus: s.accRegFeesStatus || 'Unpaid',
  photo: s.photo || null,
  receiptS3Url: s.receiptS3Url || null,
  regFeeReceiptNo: s.regFeeReceiptNo || null,
  payMode: s.payMode || null,
  paymentStatus: s.paymentStatus || null,
  transactionId: s.transactionId || null,
  merchantTransactionId: s.merchantTransactionId || null,
  isTop20: s.isTop20 || false,
  sRank: s.sRank || null,
  passout12: s.passout12 || null,
  linkSource: s.linkSource || 'default',
  remark: s.remarks || null,
  regFeeDate: s.regFeeDate || null,
  registrationNo: s.receiptNo || String(s._id),
});

// Student model se B.Tech (btech_student_reg) payload banao
const buildBtechPayload = (s) => ({
  id: s.externalId || String(s._id),
  firstName: sanitizeSqlUnsafe((s.name || '').split(' ')[0]) || '',
  lastName: sanitizeSqlUnsafe((s.name || '').split(' ').slice(1).join(' ')) || '',
  fathersName: sanitizeSqlUnsafe(s.fatherName),
  mobile: String(s.mobileNo) || null,
  whatsappNumber: Number(s.whatsappNumber || s.whatsappNo) || null,
  email: sanitizeSqlUnsafe(s.email) || `self-mkt` + Date.now() + `@ssism.org`,
  schoolName: sanitizeSqlUnsafe(s.schoolName) || '',
  persentage12: s.persentage12 || null,
  persentage11: s.persentage11 || null,
  persentage10: s.persentage10 != null ? s.persentage10 : null,
  jeeScore: s.jeeScore || null,
  district: sanitizeSqlUnsafe(s.district),
  village: normalizeVillage(s.village),
  trackName: normalizeTrackName(s.trackName),
  priority1: normalizeBranch(s.priority1) || normalizeBranch(s.branch),
  priority2: normalizeBranch(s.priority2),
  priority3: normalizeBranch(s.priority3),
  address: sanitizeSqlUnsafe(s.fullAddress),
  branch: normalizeBranch(s.branch),
  year: s.year || null,
  joinBatch: s.joinBatch || new Date().getFullYear(),
  feesScheme: s.feesScheme || null,
  dob: s.dob || null,
  school12Sub: normalizeSchool12Sub(s.school12Sub),
  rollNumber12: s.rollNumber12 || null,
  rollNumber10: s.rollNumber10 || null,
  aadharNo: s.aadharNo || null,
  fatherOccupation: sanitizeSqlUnsafe(s.fatherOccupation),
  fatherIncome: s.fatherIncome || null,
  fatherContactNumber: s.fatherContactNumber || null,
  category: normalizeCategory(s.category),
  gender: normalizeGender(s.gender),
  pincode: s.pincode || null,
  tehsil: s.tehsil || null,
  photo: s.photo || null,
  receiptS3Url: s.receiptS3Url || null,
  regFeeReceiptNo: s.regFeeReceiptNo || null,
  regFees: s.regFees || null,
  regFeesStatus: s.regFeesStatus || 'Unpaid',
  accRegFeesStatus: s.accRegFeesStatus || 'Unpaid',
  payMode: s.payMode || null,
  paymentStatus: s.paymentStatus || null,
  transactionId: s.transactionId || null,
  merchantTransactionId: s.merchantTransactionId || null,
  applicationType: s.applicationType || 'SIMPLE_APPLICATION',
  isTop20: s.isTop20 || false,
  sRank: s.sRank || null,
  passout12: s.passout12 || null,
  linkSource: s.linkSource || null,
  remark: s.remarks || null,
  regFeeDate: s.regFeeDate || null,
  registrationNo: s.receiptNo || String(s._id),
});

// ── Central ko ek student bhejo ──────────────────────────────────────────────
// Returns object: { success, reason?, missingFields?, status?, data?, error? }
const sendToCentral = async (student) => {
  const formSource = student.formSource;
  if (!['btech', 'ssism'].includes(formSource))
    return { success: false, reason: 'INVALID_SOURCE', error: `Invalid formSource: ${formSource}` };

  const isBtech = formSource === 'btech';

  const payload = isBtech ? buildBtechPayload(student) : buildSsismPayload(student);
  const apiUrl = isBtech ? process.env.CENTRAL_BTECH_API_URL : process.env.CENTRAL_SSISM_API_URL;


  // Pre-sync validation — required fields check karo
  const missingFields = isBtech ? validateForBtechSync(payload) : validateForSsismSync(payload);
  if (missingFields.length > 0) {
    console.log(`[CENTRAL SYNC] Missing fields for ${payload.firstName} ${payload.lastName}:`, missingFields);
    return { success: false, reason: 'MISSING_FIELDS', missingFields };
  }

  if (MOCK_MODE) {
    console.log(`[MOCK] Central sync — ${formSource} — student: ${student.name}`);
    console.log('[MOCK] Payload:', JSON.stringify(payload, null, 2));

    // Simulate failure for testing purposes
    const hasFailName = student.name && student.name.toLowerCase().includes('fail');
    const hasFailRemark = student.remarks && (
      student.remarks.toLowerCase().includes('fail_sync') ||
      student.remarks.toLowerCase().includes('fail')
    );
    if (hasFailName || hasFailRemark) {
      return { success: false, reason: 'MOCK_FAIL', error: 'Mock failure triggered' };
    }

    return { success: true, data: { mock: true, studentName: student.name } };
  }

  if (!apiUrl) return { success: false, reason: 'NO_API_URL', error: 'Central API URL not configured' };

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.WEBHOOK_SECRET,
      },
      timeout: 15000,
      validateStatus: () => true, // Don't throw error on non-2xx status codes
    });

    console.log(`[CENTRAL SYNC] ${formSource} — ${student.name} — Status: ${response.status}`);
    console.log('[CENTRAL SYNC] Payload:', JSON.stringify(payload, null, 2));
    console.log('[CENTRAL SYNC] Response:', JSON.stringify(response.data, null, 2));

    if (response.status === 201) {
      return { success: true, data: response.data };
    }

    // 409 = duplicate — not an error per se, but sync didn't create a new record
    if (response.status === 409) {
      return { success: false, reason: 'DUPLICATE', status: 409, error: response.data?.message || 'Student already exists in Central' };
    }

    // 400 = validation error from Central
    if (response.status === 400) {
      return { success: false, reason: 'VALIDATION_ERROR', status: 400, error: response.data?.error || response.data?.message || JSON.stringify(response.data) };
    }

    // Any other error
    return { success: false, reason: 'API_ERROR', status: response.status, error: response.data?.message || JSON.stringify(response.data) };
  } catch (err) {
    console.error("[CENTRAL SYNC] Network error:", err.message);
    return { success: false, reason: 'NETWORK_ERROR', error: err.message };
  }
};

// Bulk bhejo — array of students
const sendBulkToCentral = async (students) => {
  const results = { success: [], failed: [] };
  for (const student of students) {
    const result = await sendToCentral(student);
    if (result.success) {
      results.success.push({ id: String(student._id), name: student.name, data: result.data });
    } else {
      results.failed.push({
        id: String(student._id),
        name: student.name,
        reason: result.reason,
        error: result.error || null,
        missingFields: result.missingFields || null,
      });
    }
  }
  return results;
};

module.exports = { sendToCentral, sendBulkToCentral, buildBtechPayload, buildSsismPayload };
