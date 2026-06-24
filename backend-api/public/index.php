<?php

declare(strict_types=1);

use App\Http\ApiKernel;

require dirname(__DIR__) . '/vendor/autoload.php';

$kernel = new ApiKernel();
$kernel->handle();
