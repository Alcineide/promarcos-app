import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientesRouter from "./clientes";
import promarcosRouter from "./promarcos";
import capturaPaginaRouter from "./captura-pagina";
import downloadProjetoRouter from "./download-projeto";
import documentosRouter from "./documentos";
import zapsignRouter from "./zapsign";
import auditRouter from "./audit";
import usuariosRouter from "./usuarios";
import deviceSessionsRouter from "./device-sessions";
import luana2026Router from "./luana2026";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientesRouter);
router.use(promarcosRouter);
router.use(capturaPaginaRouter);
router.use(downloadProjetoRouter);
router.use(documentosRouter);
router.use(zapsignRouter);
router.use(auditRouter);
router.use(usuariosRouter);
router.use(deviceSessionsRouter);
router.use(luana2026Router);

export default router;
