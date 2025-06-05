library(dplyr)
library(tidyr)
library(tibble)
library(purrr)
library(ggplot2)

# Define output directory and create it if it doesn't exist
output_dir <- "resources_test"
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

# Generate either sc or xenium dataset
generate_dataset_type <- "both"  # Options: "sc", "xenium", "both"

# SC dataset parameters
sc_params <- list(
  num_samples = 10,
  cells_per_sample = 1000,
  total_counts_range = c(10, 56),
  nonzero_vars_range = c(10, 46),
  cellbender_background_mean = 0.4,
  cellbender_background_sd = 0.2,
  cell_size_base = 15,
  cell_size_sd = 10,
  droplet_efficiency_base = 0.93,
  droplet_efficiency_range = 0.05,
  # Add parameters for mitochondrial and ribosomal fractions
  mito_fraction_mean = 0.08,
  mito_fraction_sd = 0.05,
  ribo_fraction_mean = 0.12,
  ribo_fraction_sd = 0.06
)

# Xenium dataset parameters
xenium_params <- list(
  num_samples = 10,
  cells_per_sample = 1000,
  total_counts_range = c(16, 78),
  nonzero_vars_range = c(1, 2),
  cell_area_range = c(30, 150),
  nucleus_ratio_range = c(0.1, 0.35),
  spatial_noise = 5,
  # Add parameters for mitochondrial and ribosomal fractions
  mito_fraction_mean = 0.07,
  mito_fraction_sd = 0.04,
  ribo_fraction_mean = 0.10,
  ribo_fraction_sd = 0.05
)

# Transform dataframe to the expected JSON structure
transform_df <- function(df) {
  columns <- map(colnames(df), function(name) {
    data <- df[[name]]
    dtype <-
      if (is.integer(data)) {
        "integer"
      } else if (is.numeric(data)) {
        "numeric"
      } else if (is.factor(data)) {
        "categorical"
      } else if (is.logical(data)) {
        "boolean"
      } else {
        stop("Unknown / unsupported data type")
      }

    out <- list(
      name = name,
      dtype = dtype
    )

    if (dtype == "categorical") {
      out$data <- as.integer(data) - 1L
      out$categories <- levels(data)
    } else {
      out$data <- data
    }

    out
  })

  list(
    num_rows = nrow(df),
    num_cols = ncol(df),
    columns = columns
  )
}

# Generate SC dataset
generate_sc_dataset <- function(params = sc_params) {
  # Sample generation parameters
  num_samples <- params$num_samples
  cells_per_sample <- params$cells_per_sample
  total_cells <- num_samples * cells_per_sample
  
  # Generate sample IDs
  sample_ids <- factor(rep(paste0("sample_", seq_len(num_samples)), each = cells_per_sample))
  
  # Generate cell metrics
  set.seed(42)
  
  # Generate mitochondrial and ribosomal fractions with truncated normal distribution
  mito_fractions <- pmax(0, pmin(1, rnorm(total_cells, 
                                        params$mito_fraction_mean, 
                                        params$mito_fraction_sd)))
  ribo_fractions <- pmax(0, pmin(1, rnorm(total_cells, 
                                        params$ribo_fraction_mean, 
                                        params$ribo_fraction_sd)))
  
  # Add some outliers for realism (e.g., stressed or dying cells with high mito content)
  outlier_indices <- sample(1:total_cells, round(total_cells * 0.03))
  mito_fractions[outlier_indices] <- mito_fractions[outlier_indices] * 2.5
  mito_fractions <- pmin(mito_fractions, 0.8)  # Cap at 80%
  
  cell_rna_stats <- tibble(
    sample_id = factor(rep(paste0("sample_", seq_len(num_samples)), each = cells_per_sample)),
    total_counts = rep(sample(params$total_counts_range[1]:params$total_counts_range[2], 
                            cells_per_sample, replace = TRUE), num_samples),
    num_nonzero_vars = rep(sample(params$nonzero_vars_range[1]:params$nonzero_vars_range[2], 
                                cells_per_sample, replace = TRUE), num_samples),
    fraction_mitochondrial = mito_fractions,
    fraction_ribosomal = ribo_fractions,
    cellbender_background_fraction = pmax(0, rnorm(total_cells, 
                                               params$cellbender_background_mean, 
                                               params$cellbender_background_sd)) * 
                              (runif(total_cells) > 0.3),
    cellbender_cell_probability = pmax(runif(total_cells), 0.0002),
    cellbender_cell_size = pmax(params$cell_size_base + 
                              rnorm(total_cells, 0, params$cell_size_sd), 
                            params$cell_size_base),
    cellbender_droplet_efficiency = params$droplet_efficiency_base + 
                                  runif(total_cells) * params$droplet_efficiency_range
  )
  
  # Generate sample summary stats
  sample_summary_stats <- tibble(
    sample_id = factor(paste0("sample_", seq_len(num_samples))),
    rna_num_barcodes = rep(10000, num_samples),
    rna_num_barcodes_filtered = rep(cells_per_sample, num_samples),
    rna_sum_total_counts = tapply(cell_rna_stats$total_counts, 
                                 cell_rna_stats$sample_id, sum),
    rna_median_total_counts = tapply(cell_rna_stats$total_counts, 
                                    cell_rna_stats$sample_id, median),
    rna_overall_num_nonzero_vars = tapply(cell_rna_stats$num_nonzero_vars, 
                                        cell_rna_stats$sample_id, 
                                        function(x) max(x) * 49),
    rna_median_num_nonzero_vars = tapply(cell_rna_stats$num_nonzero_vars, 
                                       cell_rna_stats$sample_id, median)
  )
  
  # Generate cellranger metrics - only include the major ones
  metrics <- c(
    "Cells",
    "Mean_reads_per_cell",
    "Median_UMI_counts_per_cell", 
    "Median_genes_per_cell",
    "Sequencing_saturation",
    "Fraction_reads_in_cells",
    "Total_genes_detected",
    "Valid_barcodes"
  )
  
  set.seed(43)
  metrics_values <- lapply(metrics, function(m) {
    if (grepl("Fraction|Sequencing_saturation|Valid", m)) {
      # Values between 0 and 1
      rep(round(runif(1, 0.01, 0.99), 4), num_samples)
    } else {
      # Integer values
      rep(round(runif(1, 1, 10000)), num_samples)
    }
  })
  
  names(metrics_values) <- metrics
  metrics_df <- as_tibble(metrics_values) %>%
    mutate(sample_id = factor(paste0("sample_", seq_len(num_samples))))
  
  # Transform to required format
  output <- list(
    cell_rna_stats = transform_df(cell_rna_stats),
    sample_summary_stats = transform_df(sample_summary_stats),
    metrics_cellranger_stats = transform_df(metrics_df)
  )
  
  # Write output to file
  jsonlite::write_json(
    output,
    file.path(output_dir, "sc_dataset.json"),
    pretty = TRUE,
    auto_unbox = TRUE
  )
}

# Generate Xenium dataset
generate_xenium_dataset <- function(params = xenium_params) {
  # Sample generation parameters
  num_samples <- params$num_samples
  cells_per_sample <- params$cells_per_sample
  total_cells <- num_samples * cells_per_sample
  
  # Generate cell IDs
  set.seed(121)
  random_letters <- replicate(cells_per_sample, 
                             paste0(sample(letters, 8, replace = TRUE), collapse = ""))
  cell_ids <- paste0(random_letters, "-1")
  
  # Generate sample IDs and cell data
  set.seed(123)
  
  # Create coordinate values that match exactly cells_per_sample length
  # Create a grid pattern for the coordinates
  grid_size <- ceiling(sqrt(cells_per_sample))
  x_base <- rep(seq(400, 400 + grid_size * 10, by = 10), grid_size)[1:cells_per_sample]
  y_base <- rep(seq(300, 300 + grid_size * 10, by = 10), each = grid_size)[1:cells_per_sample]
  
  # Generate mitochondrial and ribosomal fractions with truncated normal distribution
  mito_fractions <- pmax(0, pmin(1, rnorm(total_cells, 
                                        params$mito_fraction_mean, 
                                        params$mito_fraction_sd)))
  ribo_fractions <- pmax(0, pmin(1, rnorm(total_cells, 
                                        params$ribo_fraction_mean, 
                                        params$ribo_fraction_sd)))
  
  # Add spatial patterns to mito/ribo fractions based on position
  # Cells close to each other might have similar properties
  for (i in 1:num_samples) {
    sample_indices <- ((i-1) * cells_per_sample + 1):(i * cells_per_sample)
    # Create gradient effect for mito fractions
    mito_fractions[sample_indices] <- mito_fractions[sample_indices] * 
      (1 + 0.5 * (x_base - min(x_base)) / (max(x_base) - min(x_base)))
    
    # Create pattern effect for ribo fractions
    ribo_fractions[sample_indices] <- ribo_fractions[sample_indices] * 
      (1 + 0.3 * sin((y_base - min(y_base)) / (max(y_base) - min(y_base)) * pi))
  }
  
  # Ensure values stay within valid range
  mito_fractions <- pmax(0.01, pmin(0.7, mito_fractions))
  ribo_fractions <- pmax(0.01, pmin(0.6, ribo_fractions))
  
  cell_rna_stats <- tibble(
    sample_id = factor(rep(paste0("sample_", seq_len(num_samples)), each = cells_per_sample)),
    total_counts = rep(sample(params$total_counts_range[1]:params$total_counts_range[2], 
                            cells_per_sample, replace = TRUE), num_samples),
    num_nonzero_vars = rep(sample(params$nonzero_vars_range[1]:params$nonzero_vars_range[2], 
                                cells_per_sample, replace = TRUE), num_samples),
    fraction_mitochondrial = mito_fractions,
    fraction_ribosomal = ribo_fractions,
    cell_area = rep(runif(cells_per_sample, 
                        params$cell_area_range[1], 
                        params$cell_area_range[2]), num_samples),
    nucleus_ratio = rep(runif(cells_per_sample, 
                           params$nucleus_ratio_range[1], 
                           params$nucleus_ratio_range[2]), num_samples),
    x_coord = rep(x_base, num_samples) + rnorm(total_cells, 0, params$spatial_noise),
    y_coord = rep(y_base, num_samples) + rnorm(total_cells, 0, params$spatial_noise),
    cell_id = factor(rep(cell_ids, num_samples)),
    segmentation_method = factor(rep("Segmented by nucleus expansion of 5.0µm", total_cells)),
    region = factor(rep("cell_labels", total_cells))
  )
  
  # Generate sample summary stats
  sample_summary_stats <- tibble(
    sample_id = factor(paste0("sample_", seq_len(num_samples))),
    rna_num_barcodes = rep(cells_per_sample * 2, num_samples),
    rna_num_barcodes_filtered = rep(cells_per_sample, num_samples),
    rna_sum_total_counts = tapply(cell_rna_stats$total_counts, 
                                cell_rna_stats$sample_id, sum),
    rna_median_total_counts = tapply(cell_rna_stats$total_counts, 
                                   cell_rna_stats$sample_id, median),
    rna_overall_num_nonzero_vars = rep(max(params$nonzero_vars_range) * 9, num_samples),
    rna_median_num_nonzero_vars = tapply(cell_rna_stats$num_nonzero_vars, 
                                      cell_rna_stats$sample_id, median),
    control_probe_percentage = rep(0, num_samples),
    negative_decoding_percentage = rep(0, num_samples)
  )
  
  # Transform to required format
  output <- list(
    cell_rna_stats = transform_df(cell_rna_stats),
    sample_summary_stats = transform_df(sample_summary_stats)
  )
  
  # Write output to file
  jsonlite::write_json(
    output,
    file.path(output_dir, "xenium_dataset.json"),
    pretty = TRUE,
    auto_unbox = TRUE
  )
}

# Generate datasets based on specified type
if (generate_dataset_type %in% c("sc", "both")) {
  generate_sc_dataset()
}

if (generate_dataset_type %in% c("xenium", "both")) {
  generate_xenium_dataset()
}