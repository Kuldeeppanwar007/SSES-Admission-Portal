const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { validate, schemas } = require('../middleware/validate');

router.use(protect, authorizeRoles('admin'));
router.get('/', getUsers);
router.post('/', validate(schemas.addUser), createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
