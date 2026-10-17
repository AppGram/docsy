/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    docsyAccess?: import('./lib/access').AccessIdentity;
  }
}
