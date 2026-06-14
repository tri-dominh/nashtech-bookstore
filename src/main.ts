import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'path';
import { AppModule } from './app.module';

import * as session from 'express-session';
import * as passport from 'passport';
import flash = require('connect-flash');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: '*',
  });

  app.useStaticAssets(resolve('./public'));
  app.setBaseViewsDir(resolve('./views'));
  app.setViewEngine('pug');

  app.use(
    session({
      secret: 'nest cats',
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`Server is running on port: ${port}`);
}
bootstrap();
