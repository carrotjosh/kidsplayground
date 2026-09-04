/** 业务规则校验失败时抛出（比如任务不存在、积分不够），路由里统一捕获并返回 400。 */
export class ActionError extends Error {}
