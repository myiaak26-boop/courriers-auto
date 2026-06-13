const router = require('express').Router();

router.use('/upload', require('./upload'));
router.use('/store', require('./store'));
router.use('/courriers', require('./courriers'));
router.use('/generate', require('./generate'));
router.use('/generate-pdf', require('./generatePdf'));
router.use('/send-mail', require('./sendMail'));
module.exports = router;
