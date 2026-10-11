const router = require('express').Router();
const controller = require('../controllers/jobs_controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { uploadResume } = require('../middlewares/upload');
const { validateJob, requireResume} = require('../middlewares/validate');
const applicationsController = require('../controllers/applications_controller');


router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', authenticate, authorize('EMPLOYER'), validateJob, controller.create);

router.post(
  '/:id/apply',
  authenticate,
  authorize('CANDIDATE'),
  uploadResume,
  requireResume,
  applicationsController.apply
);

router.get('/:id/applications',
            authenticate, 
            authorize('EMPLOYER'), 
            applicationsController.listForJob);

module.exports = router;