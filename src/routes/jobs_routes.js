const router = require('express').Router();
const controller = require('../controllers/jobs_controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateJob } = require('../middlewares/validate');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', authenticate, authorize('EMPLOYER'), validateJob, controller.create);

module.exports = router;