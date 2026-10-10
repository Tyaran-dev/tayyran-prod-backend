import express from "express";
import { updateUser, getUser} from "../../controllers/users/users.controller.js";
import { protectedRoute } from "../../middlewares/protectedRoute.js";
const router = express.Router();


router.post("/getUser", protectedRoute, getUser);
router.put("/updateUser", protectedRoute, updateUser);


export default router;