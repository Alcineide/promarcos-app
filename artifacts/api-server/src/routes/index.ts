import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientesRouter from "./clientes";
import promarcosRouter from "./promarcos";
import capturaPaginaRouter from "./captura-pagina";
import downloadProjetoRouter from "./download-projeto";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientesRouter);
router.use(promarcosRouter);
router.use(capturaPaginaRouter);
router.use(downloadProjetoRouter);

export default router;
