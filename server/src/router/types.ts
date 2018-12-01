import { IRouteHandlerData, IRouteData } from './interfaces';
import { Method } from './enums';
import { RouteCollection } from './route-collection';

export type NextFunction = (err?: Error) => void;
export type RouteHandler = (routeData: IRouteHandlerData, next: NextFunction, notifier?: () => void) => void;
export type Router = { [T in Method]: RouteCollection<IRouteData> };