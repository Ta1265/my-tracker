import { ClsModule } from 'nestjs-cls';

export const RequestClsModule = ClsModule.forRoot({
  middleware: { mount: true, generateId: true },
});
