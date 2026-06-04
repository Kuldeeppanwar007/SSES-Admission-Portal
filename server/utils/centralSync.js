const axios = require('axios');

const MOCK_MODE = process.env.CENTRAL_MOCK_MODE === 'true';

// Student model se SSISM (new_student_reg) payload banao
const buildSsismPayload = (s) => ({
  id: s.externalId || null,
  firstName: (s.name || '').split(' ')[0] || null,
  lastName: (s.name || '').split(' ').slice(1).join(' ') || null,
  fathersName: s.fatherName || null,
  mobile: String(s.mobileNo) || null,
  email: s.email || String('self-'+Date.now()+'@ssism.org'),
  branch: s.branch || null,
  year: s.year || 'I',
  joinBatch: new Date().getFullYear(),
  feesScheme: s.feesScheme || null,
  dob: s.dob || null,
  fatherContactNumber: String(s.fatherContactNumber) || String(s.mobileNo),
  schoolName: s.schoolName || null,
  school12Sub: s.school12Sub || String("Maths"),
  rollNumber12: s.rollNumber12 || null,
  persentage12: s.persentage12 || null,
  persentage11: s.persentage11 || null,
  persentage10: s.persentage10 || null,
  rollNumber10: s.rollNumber10 || null,
  aadharNo: s.aadharNo || null,
  fatherOccupation: s.fatherOccupation || null,
  fatherIncome: s.fatherIncome || null,
  category: s.category || null,
  gender: s.gender || null,
  pincode: s.pincode || null,
  trackName: s.trackName || null,
  address: s.fullAddress || null,
  village: s.village || null,
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
  firstName: (s.name || '').split(' ')[0] || '',
  lastName: (s.name || '').split(' ').slice(1).join(' ') || '',
  fathersName: s.fatherName || null,
  mobile: Number(s.mobileNo) || null,
  whatsappNumber: Number(s.whatsappNumber || s.whatsappNo) || null,
  email: s.email || '',
  schoolName: s.schoolName || '',
  persentage12: s.persentage12 || null,
  persentage11: s.persentage11 || null,
  persentage10: s.persentage10 || null,
  jeeScore: s.jeeScore || null,
  district: s.district || null,
  village: s.village || null,
  trackName: s.trackName || null,
  priority1: s.priority1 || s.branch || null,
  priority2: s.priority2 || null,
  priority3: s.priority3 || null,
  address: s.fullAddress || null,
  branch: s.branch || null,
  year: s.year || null,
  joinBatch: s.joinBatch || null,
  feesScheme: s.feesScheme || null,
  dob: s.dob || null,
  school12Sub: s.school12Sub || null,
  rollNumber12: s.rollNumber12 || null,
  rollNumber10: s.rollNumber10 || null,
  aadharNo: s.aadharNo || null,
  fatherOccupation: s.fatherOccupation || null,
  fatherIncome: s.fatherIncome || null,
  fatherContactNumber: s.fatherContactNumber || null,
  category: s.category || null,
  gender: s.gender || null,
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

// Central ko ek student bhejo
const sendToCentral = async (student) => {
  const formSource = student.formSource;
  if (!['btech', 'ssism'].includes(formSource))
    throw new Error(`Invalid formSource: ${formSource}`);

  const isBtech = formSource === 'btech';
  const payload = isBtech ? buildBtechPayload(student) : buildSsismPayload(student);
  const apiUrl = isBtech ? process.env.CENTRAL_BTECH_API_URL : process.env.CENTRAL_SSISM_API_URL;

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
      return false;
    }

    return true;
  }

  if (!apiUrl) return false;

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.WEBHOOK_SECRET,
      },
      timeout: 15000,
      validateStatus: () => true, // Don't throw error on non-2xx status codes
    });
    console.log(payload)
    console.log(JSON.stringify(response.data, null, 2));
    return response.status === 201;
  } catch (err) {
    console.error("Central sync error:", err.message);
    return false;
  }
};

// Bulk bhejo — array of students
const sendBulkToCentral = async (students) => {
  const results = { success: [], failed: [] };
  for (const student of students) {
    try {
      const result = await sendToCentral(student);
      if (result) {
        results.success.push({ id: String(student._id), name: student.name, result });
      } else {
        results.failed.push({ id: String(student._id), name: student.name, error: 'Central API did not return 201 status' });
      }
    } catch (err) {
      results.failed.push({ id: String(student._id), name: student.name, error: err.message });
    }
  }
  return results;
};

module.exports = { sendToCentral, sendBulkToCentral, buildBtechPayload, buildSsismPayload };
