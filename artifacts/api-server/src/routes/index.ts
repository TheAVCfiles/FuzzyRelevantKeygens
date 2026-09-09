import { Router, type IRouter } from "express";
import autographyRouter from "./autography";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(autographyRouter);

export default router;
