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
  mobile:              Joi.string().pattern(/^[6-9]\d{9}$/).required()
                         .messages({ 'string.pattern.base': 'mobile must be a valid 10-digit Indian number' }),
  email:               Joi.string().email().required(),
  whatsappNumber:      Joi.string().pattern(/^[6-9]\d{9}$/).optional().allow(''),
  address:             Joi.string().max(300).optional().allow(''),
  district:            Joi.string().max(60).optional().allow(''),
  village:             Joi.string().max(60).optional().allow(''),
  dob:                 Joi.string().optional().allow(''),
  gender:              Joi.string().valid('Male', 'Female', 'Other').optional().allow(''),
  category:            Joi.string().valid('General', 'OBC', 'SC', 'ST', 'EWS').optional().allow(''),
  aadharNo:            Joi.string().pattern(/^\d{12}$/).optional().allow('')
                         .messages({ 'string.pattern.base': 'aadharNo must be 12 digits' }),
  schoolName:          Joi.string().max(100).optional().allow(''),
  persentage12:        Joi.number().min(0).max(100).optional().allow(null),
  persentage10:        Joi.number().min(0).max(100).optional().allow(null),
  rollNumber12:        Joi.number().optional().allow(null),
  rollNumber10:        Joi.number().optional().allow(null),
  passout12:           Joi.string().max(10).optional().allow(''),
  fatherOccupation:    Joi.string().max(100).optional().allow(''),
  fatherIncome:        Joi.number().min(0).optional().allow(null),
  fatherContactNumber: Joi.string().pattern(/^[6-9]\d{9}$/).optional().allow(''),
  pincode:             Joi.number().integer().min(100000).max(999999).optional().allow(null),
  tehsil:              Joi.string().max(60).optional().allow(''),
  jeeScore:            Joi.number().min(0).max(300).optional().allow(null),
  priority1:           Joi.string().max(50).optional().allow(''),
  priority2:           Joi.string().max(50).optional().allow(''),
  priority3:           Joi.string().max(50).optional().allow(''),
  branch:              Joi.string().max(60).optional().allow(''),
  year:                Joi.string().max(10).optional().allow(''),
  feesScheme:          Joi.string().max(60).optional().allow(''),
  linkSource:          Joi.string().max(100).optional().allow(''),
  trackName:           Joi.string().max(60).optional().allow(''),
});

const addUserSchema = Joi.object({
  name:     Joi.string().min(2).max(60).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  role:     Joi.string().valid('admin', 'manager', 'track_incharge').required(),
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
