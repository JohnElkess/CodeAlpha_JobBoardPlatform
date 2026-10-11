const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

// Extension comes from our own whitelist, never from the client's filename
const ALLOWED = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/resumes'),
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}-${Date.now()}${ALLOWED[file.mimetype]}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new AppError('Resume must be a PDF, DOC or DOCX file', 400));
    }
    cb(null, true);
  },
});

module.exports = { uploadResume: upload.single('resume') }; // form-data field name: "resume"