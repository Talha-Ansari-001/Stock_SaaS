USE simple_saas_inventory;

-- Step 1: Disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Step 2: Truncate your table(s)
TRUNCATE TABLE sales;

-- Step 3: Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

show tables;

select * from orders;