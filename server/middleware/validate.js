const Joi = require('joi');

// Generic middleware factory
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,     // saari errors ek saath dikhao
    stripUnknown: true,    // extra/unknown fields hata do
  });
  if (error) {
    const messages = error.details.map(d => d.message.replace(/"/g, ''));
    return res.status(400).json({ message: messages.join(', ') });
  }
  req.body = value; // cleaned data use karo
  next();
};

// ── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(4).max(100).required(),
});

const selfRegisterSchema = Joi.object({
  formSource:          Joi.string().valid('btech', 'ssism').optional(),
  firstName:           Joi.string().min(2).max(60).required(),
  lastName:            Joi.string().max(60).optional().allow(''),
  fathersName:         Joi.string().max(60).optional().allow(''),
  fatherName:          Joi.string().max(60).optional().allow(''),  // alternate field name
  mobile:              Joi.string().pattern(/^\d{10}$/).required()  // any 10-digit number
                         .messages({ 'string.pattern.base': 'mobile must be a 10-digit number' }),
  email:               Joi.string().email().optional().allow('', null),
  whatsappNumber:      Joi.string().optional().allow('', null),
  parentMobile:        Joi.string().optional().allow('', null),
  parentMobil:         Joi.string().optional().allow('', null),  // typo variant
  address:             Joi.string().max(300).optional().allow(''),
  district:            Joi.string().max(60).optional().allow(''),
  village:             Joi.string().max(60).optional().allow(''),
  dob:                 Joi.string().optional().allow(''),
  gender:              Joi.string().optional().allow('', null),
  category:            Joi.string().optional().allow('', null),
  aadharNo:            Joi.string().optional().allow('', null),
  schoolName:          Joi.string().max(100).optional().allow(''),
  persentage12:        Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  persentage10:        Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  persentage11:        Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  percent10:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),  // alternate
  percent11:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),  // alternate
  percent12:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),  // alternate
  rollNumber12:        Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  rollNumber10:        Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  passout12:           Joi.string().max(10).optional().allow(''),
  fatherOccupation:    Joi.string().optional().allow('', null),
  fatherIncome:        Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  fatherContactNumber: Joi.string().optional().allow('', null),
  pincode:             Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  tehsil:              Joi.string().max(60).optional().allow(''),
  jeeScore:            Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  priority1:           Joi.string().max(50).optional().allow(''),
  priority2:           Joi.string().max(50).optional().allow(''),
  priority3:           Joi.string().max(50).optional().allow(''),
  branch:              Joi.string().optional().allow('', null),
  course:              Joi.string().optional().allow('', null),  // alternate for branch
  stream:              Joi.string().optional().allow('', null),  // alternate for school12Sub
  year:                Joi.string().optional().allow('', null),
  feesScheme:          Joi.string().optional().allow('', null),
  linkSource:          Joi.string().optional().allow('', null),
  trackName:           Joi.string().optional().allow('', null),
  track:               Joi.string().optional().allow('', null),  // alternate for trackName
  joinBatch:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  isTop20:             Joi.alternatives().try(Joi.boolean(), Joi.number(), Joi.string()).optional().allow(null, ''),
  regFees:             Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  tutionFee:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  tuitionFee:          Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
  sRank:               Joi.string().optional().allow('', null),
  subject12:           Joi.string().optional().allow('', null),
  photo:               Joi.string().optional().allow('', null),
  school12Sub:         Joi.string().optional().allow('', null),
  accRegFeesStatus:    Joi.string().optional().allow('', null),
  applicationType:     Joi.string().optional().allow('', null),
  applicationTyp:      Joi.string().optional().allow('', null),  // typo variant
  createdBy:           Joi.string().optional().allow('', null),
  jsId:                Joi.string().optional().allow('', null),
  locationURL:         Joi.string().optional().allow('', null),
  payMode:             Joi.string().optional().allow('', null),
  paymentRequired:     Joi.alternatives().try(Joi.boolean(), Joi.string(), Joi.number()).optional().allow(null),
  prkey:               Joi.string().optional().allow('', null),  // student external ID
  webhookSecret:       Joi.string().optional().allow('', null),  // optional auth header in body
  batch:               Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(null, ''),
});

const addUserSchema = Joi.object({
  name:     Joi.string().min(2).max(60).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  role:     Joi.string().valid('admin', 'manager', 'track_incharge', 'interviewer').required(),
  track:    Joi.string().max(60).optional().allow(''),
});

const updateStatusSchema = Joi.object({
  status:  Joi.string().valid('Applied', 'Calling', 'Admitted', 'Rejected', 'Disabled').required(),
  remarks: Joi.string().max(500).optional().allow(''),
});

const markAttendanceSchema = Joi.object({
  latitude:       Joi.number().min(-90).max(90).required(),
  longitude:      Joi.number().min(-180).max(180).required(),
  locationSource: Joi.string().valid('GPS', 'Google', 'Browser').optional(),
  accuracy:       Joi.number().optional(),
});

module.exports = {
  validate,
  schemas: {
    login:          loginSchema,
    selfRegister:   selfRegisterSchema,
    addUser:        addUserSchema,
    updateStatus:   updateStatusSchema,
    markAttendance: markAttendanceSchema,
  },
};
