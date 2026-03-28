import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientesRouter from "./clientes";
import promarcosRouter from "./promarcos";
import provasRouter from "./provas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientesRouter);
router.use(promarcosRouter);
router.use(provasRouter);

export default router;
