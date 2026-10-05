const router = require('express').Router();
const controller = require('../controllers/auth_controller');
const { validateRegister, validateLogin } = require('../middlewares/validate');

router.post('/register', validateRegister, controller.register);
router.post('/login', validateLogin, controller.login);

module.exports = router;