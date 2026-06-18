import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import agentsRouter from "./agents";
import tasksRouter from "./tasks";
import executionsRouter from "./executions";
import workflowsRouter from "./workflows";

const router: IRouter = Router();

router.use(healthRouter);
router.use(organizationsRouter);
router.use(agentsRouter);
router.use(tasksRouter);
router.use(executionsRouter);
router.use(workflowsRouter);

export default router;
