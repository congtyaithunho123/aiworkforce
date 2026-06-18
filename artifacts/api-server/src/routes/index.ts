import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import agentsRouter from "./agents";
import tasksRouter from "./tasks";
import executionsRouter from "./executions";
import workflowsRouter from "./workflows";
import departmentsRouter from "./departments";
import skillsRouter from "./skills";
import analyticsRouter from "./analytics";
import toolsRouter from "./tools-api";
import salesRouter from "./sales";
import marketingRouter from "./marketing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(organizationsRouter);
router.use(agentsRouter);
router.use(tasksRouter);
router.use(executionsRouter);
router.use(workflowsRouter);
router.use(departmentsRouter);
router.use(skillsRouter);
router.use(analyticsRouter);
router.use(toolsRouter);
router.use(salesRouter);
router.use(marketingRouter);

export default router;
