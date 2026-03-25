import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientesRouter from "./clientes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientesRouter);

export default router;
