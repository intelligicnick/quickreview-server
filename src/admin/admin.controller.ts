import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { AdminPlatformService } from './admin-platform.service';
import { AdminService } from './admin.service';
import {
  AdminContactQueryDto,
  AdminLocationsQueryDto,
  AdminOrdersQueryDto,
  AdminPaymentsQueryDto,
  AdminQrCodesQueryDto,
  AdminSubscriptionsQueryDto,
  AdminUsersQueryDto,
  AssignQrCodeDto,
  CreateManualPaymentDto,
  CreateMarketplaceCategoryDto,
  CreateQrBatchDto,
  CreateQrProductDto,
  GrantCompSubscriptionDto,
  MarkPaymentPaidDto,
  SetQrPrintedDto,
  TransferBusinessDto,
  UpdateAdminLocationDto,
  UpdateAdminUserDto,
  UpdateMarketplaceCategoryDto,
  UpdateMarketplaceOrderDto,
  UpdatePlanDto,
  UpdateQrProductDto,
} from './dto/admin.dto';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly platform: AdminPlatformService,
  ) {}

  @Get('overview')
  async overview() {
    const [base, desk] = await Promise.all([this.adminService.overview(), this.platform.deskQueues()]);
    return { ...base, desk };
  }

  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query.q, query.status);
  }

  @Get('users/:userId')
  getUser(@Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string) {
    return this.adminService.getUser(userId);
  }

  @Patch('users/:userId')
  updateUser(
    @CurrentUser() actor: User,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminService.updateUser(actor, userId, dto);
  }

  @Post('users/:userId/login-as')
  loginAs(
    @CurrentUser() actor: User,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ) {
    return this.adminService.beginLoginAs(actor, userId);
  }

  @Get('locations')
  listLocations(@Query() query: AdminLocationsQueryDto) {
    return this.adminService.listLocations(query.q);
  }

  @Patch('locations/:locationId')
  updateLocation(
    @CurrentUser() actor: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateAdminLocationDto,
  ) {
    return this.adminService.updateLocation(actor, locationId, dto);
  }

  @Post('locations/:locationId/refresh-metrics')
  refreshMetrics(
    @CurrentUser() actor: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.platform.refreshLocationMetrics(actor, locationId);
  }

  @Get('plans')
  listPlans() {
    return this.platform.listPlans();
  }

  @Patch('plans/:planId')
  updatePlan(
    @Param('planId', new ParseUUIDPipe({ version: '4' })) planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.platform.updatePlan(planId, dto);
  }

  @Get('subscriptions')
  listSubscriptions(@Query() query: AdminSubscriptionsQueryDto) {
    return this.platform.listSubscriptions(query.status);
  }

  @Post('subscriptions/comp')
  grantComp(@CurrentUser() actor: User, @Body() dto: GrantCompSubscriptionDto) {
    return this.platform.grantComp(actor, dto);
  }

  @Get('subscriptions/:subscriptionId/invoice')
  subscriptionInvoice(
    @Param('subscriptionId', new ParseUUIDPipe({ version: '4' })) subscriptionId: string,
  ) {
    return this.platform.subscriptionInvoice(subscriptionId);
  }

  @Get('payments')
  listPayments(@Query() query: AdminPaymentsQueryDto) {
    return this.platform.listPayments(query.status);
  }

  @Post('payments/manual')
  createManualPayment(@CurrentUser() actor: User, @Body() dto: CreateManualPaymentDto) {
    return this.platform.createManualPayment(actor, dto);
  }

  @Post('payments/:paymentId/mark-paid')
  markPaymentPaid(
    @CurrentUser() actor: User,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: MarkPaymentPaidDto,
  ) {
    return this.platform.markPaymentPaid(actor, paymentId, dto.note);
  }

  @Get('marketplace/categories')
  listMarketplaceCategories() {
    return this.platform.listMarketplaceCategories();
  }

  @Post('marketplace/categories')
  createMarketplaceCategory(@Body() dto: CreateMarketplaceCategoryDto) {
    return this.platform.createMarketplaceCategory(dto);
  }

  @Patch('marketplace/categories/:categoryId')
  updateMarketplaceCategory(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Body() dto: UpdateMarketplaceCategoryDto,
  ) {
    return this.platform.updateMarketplaceCategory(categoryId, dto);
  }

  @Get('marketplace/products')
  listQrProducts() {
    return this.platform.listQrProducts();
  }

  @Post('marketplace/products')
  createQrProduct(@Body() dto: CreateQrProductDto) {
    return this.platform.createQrProduct(dto);
  }

  @Patch('marketplace/products/:productId')
  updateQrProduct(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateQrProductDto,
  ) {
    return this.platform.updateQrProduct(productId, dto);
  }

  @Get('marketplace/orders')
  listOrders(@Query() query: AdminOrdersQueryDto) {
    return this.platform.listOrders(query.status);
  }

  @Patch('marketplace/orders/:orderId')
  updateOrder(
    @CurrentUser() actor: User,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: UpdateMarketplaceOrderDto,
  ) {
    return this.platform.updateOrderStatus(actor, orderId, dto.status);
  }

  @Get('qr-codes')
  listQrCodes(@Query() query: AdminQrCodesQueryDto) {
    return this.platform.listQrCodes(query.batchId, query.unassigned === 'true');
  }

  @Post('qr-codes/batches')
  createQrBatch(@CurrentUser() actor: User, @Body() dto: CreateQrBatchDto) {
    return this.platform.createQrBatch(actor, dto.size);
  }

  @Post('qr-codes/:codeId/assign')
  assignQr(
    @CurrentUser() actor: User,
    @Param('codeId', new ParseUUIDPipe({ version: '4' })) codeId: string,
    @Body() dto: AssignQrCodeDto,
  ) {
    return this.platform.assignQrCode(actor, codeId, dto);
  }

  @Post('qr-codes/:codeId/unassign')
  unassignQr(
    @CurrentUser() actor: User,
    @Param('codeId', new ParseUUIDPipe({ version: '4' })) codeId: string,
  ) {
    return this.platform.unassignQrCode(actor, codeId);
  }

  @Patch('qr-codes/:codeId/printed')
  setQrPrinted(
    @CurrentUser() actor: User,
    @Param('codeId', new ParseUUIDPipe({ version: '4' })) codeId: string,
    @Body() dto: SetQrPrintedDto,
  ) {
    return this.platform.setQrPrinted(actor, codeId, dto.isPrinted);
  }

  @Get('contact-messages')
  listContact(@Query() query: AdminContactQueryDto) {
    return this.platform.listContactMessages(query.open === 'true');
  }

  @Post('contact-messages/:messageId/handled')
  markContactHandled(
    @CurrentUser() actor: User,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ) {
    return this.platform.markContactHandled(actor, messageId);
  }

  @Delete('locations/:locationId')
  deleteLocation(
    @CurrentUser() actor: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.adminService.deleteLocation(actor, locationId);
  }

  @Post('businesses/:businessId/transfer')
  transfer(
    @CurrentUser() actor: User,
    @Param('businessId', new ParseUUIDPipe({ version: '4' })) businessId: string,
    @Body() dto: TransferBusinessDto,
  ) {
    return this.adminService.transferBusiness(actor, businessId, dto.email);
  }
}
