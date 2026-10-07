#!/usr/bin/env bun
// 잔액(충전금/포인트) 조회
//   bun run balance.ts
import { buildClient, pretty } from "./lib/client";

const client = buildClient();
const res = await client.getBalance();
console.log("💰 솔라피 잔액");
console.log(pretty(res));
