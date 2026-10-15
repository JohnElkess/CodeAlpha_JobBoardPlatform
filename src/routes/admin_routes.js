const router = require('express').Router();
const controller = require('../controllers/admin_controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateUserActive } = require('../middlewares/validate');

router.use(authenticate, authorize('ADMIN')); // the whole router is admin-only

router.get('/stats', controller.stats);
router.get('/users', controller.users);
router.patch('/users/:id', validateUserActive, controller.setActive);

module.exports = router;