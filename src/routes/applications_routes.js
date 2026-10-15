const router = require('express').Router();
const controller = require('../controllers/applications_controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateStatus } = require('../middlewares/validate');

router.use(authenticate); // every route below requires a valid token

router.get('/my', authorize('CANDIDATE'), controller.my);
router.get('/:id/resume', controller.resume); // either role; the service decides who may see it
router.patch('/:id/status', authorize('EMPLOYER'), validateStatus, controller.updateStatus);
router.patch('/:id/withdraw', authorize('CANDIDATE'), controller.withdraw);

module.exports = router;