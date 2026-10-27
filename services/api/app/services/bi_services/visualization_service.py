import logging

logger = logging.getLogger(__name__)
"""
Data Visualization Service
Generates charts and graphs for dashboards.
Consistent with BI service patterns.
"""

from typing import Any, Dict, List, Optional
import statistics

from app.services.bi_services.errors import BIError


class VisualizationError(BIError):
    """Visualization-specific errors"""
    pass


class VisualizationService:
    """Service for creating data visualizations"""
    
    @staticmethod
    def create_bar_chart(
        data: List[Dict[str, Any]],
        x_column: str,
        y_column: str,
        title: str = "Bar Chart",
        x_label: Optional[str] = None,
        y_label: Optional[str] = None,
        color: str = "#3B82F6",
        sort_by_value: bool = True,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Create bar chart data"""
        if not data:
            raise VisualizationError("No data provided for bar chart", "empty_data")
        
        if not x_column or not y_column:
            raise VisualizationError("Missing required columns", "missing_columns")
        
        # Group and aggregate data
        grouped = {}
        for record in data:
            x_value = record.get(x_column)
            y_value = record.get(y_column)
            
            if x_value is not None and y_value is not None:
                try:
                    y_numeric = float(y_value)
                    if x_value not in grouped:
                        grouped[x_value] = []
                    grouped[x_value].append(y_numeric)
                except (ValueError, TypeError):
                    continue
        
        # Calculate averages
        chart_data = []
        for x_val, y_vals in grouped.items():
            if y_vals:
                avg_value = statistics.mean(y_vals)
                chart_data.append({
                    "category": str(x_val),
                    "value": round(avg_value, 2),
                    "count": len(y_vals)
                })
        
        # Sort and limit
        if sort_by_value:
            chart_data.sort(key=lambda x: x["value"], reverse=True)
        else:
            chart_data.sort(key=lambda x: x["category"])
        
        chart_data = chart_data[:limit]
        
        return {
            "type": "bar",
            "title": title,
            "x_label": x_label or x_column,
            "y_label": y_label or y_column,
            "color": color,
            "data": chart_data,
            "config": {
                "responsive": True,
                "maintainAspectRatio": True,
                "show_values": True,
                "stacked": False
            },
            "metadata": {
                "data_points": len(data),
                "grouped_categories": len(grouped),
                "x_column": x_column,
                "y_column": y_column
            }
        }
    
    @staticmethod
    def create_line_chart(
        data: List[Dict[str, Any]],
        x_column: str,
        y_column: str,
        title: str = "Line Chart",
        x_label: Optional[str] = None,
        y_label: Optional[str] = None,
        color: str = "#10B981",
        smooth: bool = True
    ) -> Dict[str, Any]:
        """Create line chart data for time series"""
        if not data:
            raise VisualizationError("No data provided for line chart", "empty_data")
        
        if not x_column or not y_column:
            raise VisualizationError("Missing required columns", "missing_columns")
        
        # Sort by x_column (assumed to be date/time)
        sorted_data = sorted(
            [r for r in data if r.get(x_column) is not None and r.get(y_column) is not None],
            key=lambda x: str(x.get(x_column, ""))
        )
        
        chart_data = []
        for record in sorted_data:
            x_value = record.get(x_column)
            y_value = record.get(y_column)
            
            if x_value is not None and y_value is not None:
                try:
                    y_numeric = float(y_value)
                    chart_data.append({
                        "x": str(x_value),
                        "y": round(y_numeric, 2)
                    })
                except (ValueError, TypeError):
                    continue
        
        # Group by time period if too many points
        if len(chart_data) > 50:
            # Simple downsampling: take every nth point
            step = max(1, len(chart_data) // 50)
            chart_data = chart_data[::step]
        
        # Calculate statistics
        y_values = [point["y"] for point in chart_data]
        stats = {}
        if y_values:
            stats = {
                "min": min(y_values),
                "max": max(y_values),
                "avg": statistics.mean(y_values) if len(y_values) > 1 else y_values[0],
                "trend": "increasing" if len(y_values) > 1 and y_values[-1] > y_values[0] else "decreasing"
            }
        
        return {
            "type": "line",
            "title": title,
            "x_label": x_label or x_column,
            "y_label": y_label or y_column,
            "color": color,
            "data": chart_data,
            "config": {
                "responsive": True,
                "tension": 0.4 if smooth else 0,
                "fill": False,
                "point_radius": 3,
                "show_grid": True
            },
            "metadata": {
                "data_points": len(chart_data),
                "x_column": x_column,
                "y_column": y_column,
                "statistics": stats
            }
        }
    
    @staticmethod
    def create_pie_chart(
        data: List[Dict[str, Any]],
        category_column: str,
        value_column: str,
        title: str = "Pie Chart",
        limit: int = 8,
        colors: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create pie/donut chart data"""
        if not data:
            raise VisualizationError("No data provided for pie chart", "empty_data")
        
        if not category_column or not value_column:
            raise VisualizationError("Missing required columns", "missing_columns")
        
        if not colors:
            colors = [
                "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
                "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
            ]
        
        # Aggregate data
        aggregated = {}
        for record in data:
            category = record.get(category_column)
            value = record.get(value_column)
            
            if category is not None and value is not None:
                try:
                    value_num = float(value)
                    if category not in aggregated:
                        aggregated[category] = 0
                    aggregated[category] += value_num
                except (ValueError, TypeError):
                    continue
        
        # Convert to list and sort
        chart_data = [
            {"category": str(cat), "value": round(val, 2)}
            for cat, val in aggregated.items()
        ]
        chart_data.sort(key=lambda x: x["value"], reverse=True)
        
        # Apply limit and add colors
        limited_data = chart_data[:limit]
        if len(chart_data) > limit:
            other_sum = sum(item["value"] for item in chart_data[limit:])
            if other_sum > 0:
                limited_data.append({
                    "category": "Other",
                    "value": round(other_sum, 2)
                })
        
        # Assign colors
        for i, item in enumerate(limited_data):
            item["color"] = colors[i % len(colors)]
        
        # Calculate percentages
        total = sum(item["value"] for item in limited_data)
        for item in limited_data:
            item["percentage"] = round((item["value"] / total * 100) if total > 0 else 0, 1)
        
        return {
            "type": "pie",
            "title": title,
            "data": limited_data,
            "config": {
                "responsive": True,
                "donut": False,
                "show_percentages": True,
                "show_legend": True
            },
            "metadata": {
                "data_points": len(data),
                "total_value": total,
                "category_column": category_column,
                "value_column": value_column,
                "unique_categories": len(aggregated)
            }
        }
    
    @staticmethod
    def create_scatter_plot(
        data: List[Dict[str, Any]],
        x_column: str,
        y_column: str,
        color_column: Optional[str] = None,
        size_column: Optional[str] = None,
        title: str = "Scatter Plot",
        x_label: Optional[str] = None,
        y_label: Optional[str] = None,
        max_points: int = 100
    ) -> Dict[str, Any]:
        """Create scatter plot data"""
        if not data:
            raise VisualizationError("No data provided for scatter plot", "empty_data")
        
        if not x_column or not y_column:
            raise VisualizationError("Missing required columns", "missing_columns")
        
        chart_data = []
        for record in data[:max_points]:  # Limit points for performance
            x_value = record.get(x_column)
            y_value = record.get(y_column)
            
            if x_value is not None and y_value is not None:
                try:
                    x_num = float(x_value)
                    y_num = float(y_value)
                    
                    point = {
                        "x": round(x_num, 2),
                        "y": round(y_num, 2),
                        "label": f"{x_value}, {y_value}"
                    }
                    
                    if color_column:
                        point["color"] = str(record.get(color_column, "#3B82F6"))
                    
                    if size_column:
                        size_val = record.get(size_column)
                        if size_val:
                            try:
                                point["size"] = float(size_val)
                            except (ValueError, TypeError):
                                point["size"] = 5
                        else:
                            point["size"] = 5
                    else:
                        point["size"] = 5
                    
                    chart_data.append(point)
                    
                except (ValueError, TypeError):
                    continue
        
        # Calculate correlation if enough points
        correlation = None
        if len(chart_data) >= 3:
            try:
                x_vals = [p["x"] for p in chart_data]
                y_vals = [p["y"] for p in chart_data]
                correlation = round(statistics.correlation(x_vals, y_vals), 3)
            except (statistics.StatisticsError, ValueError):
                correlation = None
        
        return {
            "type": "scatter",
            "title": title,
            "x_label": x_label or x_column,
            "y_label": y_label or y_column,
            "data": chart_data,
            "config": {
                "responsive": True,
                "show_trendline": True,
                "show_grid": True,
                "point_size": "dynamic" if size_column else "fixed"
            },
            "metadata": {
                "data_points": len(chart_data),
                "x_column": x_column,
                "y_column": y_column,
                "color_column": color_column,
                "size_column": size_column,
                "correlation": correlation
            }
        }
    
    @staticmethod
    def create_histogram(
        data: List[Dict[str, Any]],
        value_column: str,
        title: str = "Histogram",
        bins: int = 10,
        color: str = "#8B5CF6"
    ) -> Dict[str, Any]:
        """Create histogram data"""
        if not data:
            raise VisualizationError("No data provided for histogram", "empty_data")
        
        if not value_column:
            raise VisualizationError("Missing value column", "missing_column")
        
        # Extract values
        values = []
        for record in data:
            value = record.get(value_column)
            if value is not None:
                try:
                    values.append(float(value))
                except (ValueError, TypeError):
                    continue
        
        if not values:
            raise VisualizationError("No numeric values found for histogram", "no_numeric_data")
        
        # Calculate bins
        min_val = min(values)
        max_val = max(values)
        bin_width = (max_val - min_val) / bins if max_val > min_val else 1
        
        # Create bins
        histogram_data = []
        for i in range(bins):
            bin_start = min_val + (i * bin_width)
            bin_end = bin_start + bin_width
            
            if i == bins - 1:  # Last bin includes max value
                bin_end = max_val
            
            count = sum(1 for v in values if bin_start <= v < bin_end)
            if i == bins - 1:  # Include max value in last bin
                count = sum(1 for v in values if bin_start <= v <= bin_end)
            
            histogram_data.append({
                "bin": f"{bin_start:.1f}-{bin_end:.1f}",
                "count": count,
                "bin_start": round(bin_start, 2),
                "bin_end": round(bin_end, 2)
            })
        
        # Calculate distribution statistics
        stats = {
            "min": min_val,
            "max": max_val,
            "mean": statistics.mean(values),
            "median": statistics.median(values) if len(values) >= 1 else None,
            "std_dev": statistics.stdev(values) if len(values) >= 2 else 0,
            "skewness": VisualizationService._calculate_skewness(values) if len(values) >= 3 else None
        }
        
        return {
            "type": "histogram",
            "title": title,
            "data": histogram_data,
            "config": {
                "responsive": True,
                "show_density": False,
                "color": color,
                "bin_count": bins
            },
            "metadata": {
                "data_points": len(values),
                "value_column": value_column,
                "statistics": stats
            }
        }
    
    @staticmethod
    def create_metrics_card(
        data: List[Dict[str, Any]],
        metric_column: str,
        title: str = "Metric",
        aggregation: str = "sum",
        comparison_period: Optional[str] = None,
        format: str = "number",
        prefix: str = "",
        suffix: str = ""
    ) -> Dict[str, Any]:
        """Create metrics card/KPI visualization"""
        if not data:
            raise VisualizationError("No data provided for metrics card", "empty_data")
        
        if not metric_column:
            raise VisualizationError("Missing metric column", "missing_column")
        
        values = []
        for record in data:
            value = record.get(metric_column)
            if value is not None:
                try:
                    values.append(float(value))
                except (ValueError, TypeError):
                    continue
        
        if not values:
            metric_value = 0
        else:
            if aggregation == "sum":
                metric_value = sum(values)
            elif aggregation == "avg":
                metric_value = statistics.mean(values)
            elif aggregation == "median":
                metric_value = statistics.median(values)
            elif aggregation == "min":
                metric_value = min(values)
            elif aggregation == "max":
                metric_value = max(values)
            elif aggregation == "count":
                metric_value = len(values)
            else:
                metric_value = sum(values)
        
        # Calculate trend if comparison period provided
        trend = None
        if comparison_period and len(values) > 1:
            # Simple trend: compare first half vs second half
            split = len(values) // 2
            first_half = values[:split]
            second_half = values[split:]
            
            if first_half and second_half:
                first_avg = statistics.mean(first_half)
                second_avg = statistics.mean(second_half)
                if first_avg != 0:
                    trend_percent = ((second_avg - first_avg) / first_avg) * 100
                    trend = {
                        "value": round(trend_percent, 1),
                        "direction": "up" if trend_percent > 0 else "down",
                        "is_positive": trend_percent > 0,
                        "description": f"{'Increase' if trend_percent > 0 else 'Decrease'} of {abs(trend_percent):.1f}%"
                    }
        
        # Format value
        formatted_value = ""
        if format == "currency":
            formatted_value = f"{prefix}{metric_value:,.2f}{suffix}"
        elif format == "percent":
            formatted_value = f"{metric_value:.1f}%"
        elif format == "number":
            if metric_value >= 1000000:
                formatted_value = f"{prefix}{metric_value/1000000:.1f}M{suffix}"
            elif metric_value >= 1000:
                formatted_value = f"{prefix}{metric_value/1000:.1f}K{suffix}"
            else:
                formatted_value = f"{prefix}{metric_value:.0f}{suffix}"
        else:
            formatted_value = f"{prefix}{metric_value:.2f}{suffix}"
        
        return {
            "type": "metric",
            "title": title,
            "value": round(metric_value, 2),
            "formatted_value": formatted_value,
            "aggregation": aggregation,
            "trend": trend,
            "config": {
                "format": format,
                "show_trend": trend is not None,
                "compact": True
            },
            "metadata": {
                "data_points": len(values),
                "metric_column": metric_column,
                "has_trend": trend is not None
            }
        }
    
    @classmethod
    def auto_generate_visualizations(
        cls,
        data: List[Dict[str, Any]],
        columns: List[str],
        analytics_result: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Automatically generate meaningful visualizations based on data"""
        if not data or not columns:
            return []
        
        visualizations = []
        
        try:
            # Get column types from analytics if available
            column_types = {}
            if analytics_result and "internal_technical" in analytics_result:
                col_analytics = analytics_result["internal_technical"].get("column_analytics", {})
                for col, analytics in col_analytics.items():
                    column_types[col] = analytics.get("column_type", "unknown")
            else:
                # Simple type inference
                for col in columns:
                    sample_values = [d.get(col) for d in data[:10] if d.get(col) is not None]
                    if not sample_values:
                        column_types[col] = "unknown"
                        continue
                    
                    # Try to infer type
                    numeric_count = 0
                    for val in sample_values:
                        try:
                            float(val)
                            numeric_count += 1
                        except (ValueError, TypeError):
                            pass
                    
                    if numeric_count / len(sample_values) > 0.7:
                        column_types[col] = "numeric"
                    else:
                        column_types[col] = "categorical"
            
            # Find date columns
            date_columns = [col for col, col_type in column_types.items() 
                           if col_type == "date" or "date" in col.lower() or "time" in col.lower()]
            
            # Find numeric columns
            numeric_columns = [col for col, col_type in column_types.items() 
                              if col_type == "numeric" or "amount" in col.lower() 
                              or "price" in col.lower() or "sales" in col.lower()]
            
            # Find categorical columns
            categorical_columns = [col for col, col_type in column_types.items() 
                                  if col_type == "categorical" or col not in date_columns + numeric_columns]
            
            # 1. Create metrics cards for key numeric columns
            for num_col in numeric_columns[:3]:  # Top 3 numeric columns
                try:
                    card = cls.create_metrics_card(
                        data=data,
                        metric_column=num_col,
                        title=num_col.replace("_", " ").title(),
                        aggregation="sum",
                        format="currency" if any(word in num_col.lower() for word in ["price", "amount", "sales", "revenue"]) else "number",
                        prefix="$ " if "usd" in num_col.lower() else "",
                        suffix=" units" if "quantity" in num_col.lower() else ""
                    )
                    visualizations.append(card)
                except VisualizationError:
                    continue  # Skip if this column fails
            
            # 2. Create bar chart for top categories
            if categorical_columns and numeric_columns:
                cat_col = categorical_columns[0]
                num_col = numeric_columns[0] if numeric_columns else None
                
                if num_col:
                    try:
                        bar_chart = cls.create_bar_chart(
                            data=data,
                            x_column=cat_col,
                            y_column=num_col,
                            title=f"{cat_col.replace('_', ' ').title()} by {num_col.replace('_', ' ').title()}",
                            x_label=cat_col.replace("_", " ").title(),
                            y_label=num_col.replace("_", " ").title(),
                            limit=8
                        )
                        visualizations.append(bar_chart)
                    except VisualizationError:
                        pass
            
            # 3. Create line chart for time series if date column exists
            if date_columns and numeric_columns:
                date_col = date_columns[0]
                num_col = numeric_columns[0]
                
                try:
                    line_chart = cls.create_line_chart(
                        data=data,
                        x_column=date_col,
                        y_column=num_col,
                        title=f"{num_col.replace('_', ' ').title()} Trend",
                        x_label=date_col.replace("_", " ").title(),
                        y_label=num_col.replace("_", " ").title(),
                        smooth=True
                    )
                    visualizations.append(line_chart)
                except VisualizationError:
                    pass
            
            # 4. Create pie chart for distribution
            if categorical_columns and numeric_columns:
                cat_col = categorical_columns[0]
                num_col = numeric_columns[0]
                
                try:
                    pie_chart = cls.create_pie_chart(
                        data=data,
                        category_column=cat_col,
                        value_column=num_col,
                        title=f"{num_col.replace('_', ' ').title()} Distribution",
                        limit=6
                    )
                    visualizations.append(pie_chart)
                except VisualizationError:
                    pass
            
            # 5. Create scatter plot if we have two numeric columns
            if len(numeric_columns) >= 2:
                try:
                    scatter = cls.create_scatter_plot(
                        data=data[:50],  # Limit for performance
                        x_column=numeric_columns[0],
                        y_column=numeric_columns[1],
                        title=f"{numeric_columns[0].replace('_', ' ').title()} vs {numeric_columns[1].replace('_', ' ').title()}",
                        x_label=numeric_columns[0].replace("_", " ").title(),
                        y_label=numeric_columns[1].replace("_", " ").title()
                    )
                    visualizations.append(scatter)
                except VisualizationError:
                    pass
            
            # 6. Create histogram for key numeric column
            if numeric_columns:
                hist_col = numeric_columns[0]
                try:
                    histogram = cls.create_histogram(
                        data=data,
                        value_column=hist_col,
                        title=f"{hist_col.replace('_', ' ').title()} Distribution",
                        bins=8
                    )
                    visualizations.append(histogram)
                except VisualizationError:
                    pass
            
            return visualizations
            
        except Exception as e:
            logger.exception("Failed to generate visualizations: %s", str(e))
            return []
    
    @staticmethod
    def _calculate_skewness(values: List[float]) -> float:
        """Calculate skewness of a distribution"""
        if len(values) < 3:
            return 0.0
        
        mean = statistics.mean(values)
        std_dev = statistics.stdev(values) if len(values) > 1 else 0
        
        if std_dev == 0:
            return 0.0
        
        cubed_deviations = sum((x - mean) ** 3 for x in values)
        n = len(values)
        
        # Calculate skewness
        skewness = (cubed_deviations / n) / (std_dev ** 3)
        return round(skewness, 3)

    @staticmethod
    def create_heatmap(
        data: List[Dict[str, Any]],
        x_column: str,
        y_column: str,
        value_column: str,
        title: str = "Heatmap",
        color_scheme: str = "Blues"
    ) -> Dict[str, Any]:
        """Create heatmap data (x, y, value matrix)"""
        if not data:
            raise VisualizationError("No data provided for heatmap", "empty_data")
            
        # Aggregate data into a matrix
        matrix = {}
        x_labels = set()
        y_labels = set()
        
        for record in data:
            x = record.get(x_column)
            y = record.get(y_column)
            val = record.get(value_column)
            
            if x is not None and y is not None and val is not None:
                try:
                    val_float = float(val)
                    key = (str(x), str(y))
                    matrix[key] = matrix.get(key, 0) + val_float
                    x_labels.add(str(x))
                    y_labels.add(str(y))
                except (ValueError, TypeError):
                    continue
        
        # Format for frontend
        chart_data = []
        for (x, y), val in matrix.items():
            chart_data.append({"x": x, "y": y, "value": val})
            
        return {
            "type": "heatmap",
            "title": title,
            "data": chart_data,
            "config": {
                "x_labels": sorted(list(x_labels)),
                "y_labels": sorted(list(y_labels)),
                "color_scheme": color_scheme,
                "show_legend": True
            }
        }

    @staticmethod
    def create_sankey(
        data: List[Dict[str, Any]],
        source_column: str,
        target_column: str,
        value_column: str,
        title: str = "Sankey Diagram"
    ) -> Dict[str, Any]:
        """Create Sankey diagram data (source -> target flows)"""
        # Aggregate flows
        flows = {}
        nodes = set()
        
        for record in data:
            source = record.get(source_column)
            target = record.get(target_column)
            val = record.get(value_column, 1) # Default to 1 (count) if no value
            
            if source and target:
                s_str, t_str = str(source), str(target)
                key = (s_str, t_str)
                try:
                    flows[key] = flows.get(key, 0) + float(val)
                    nodes.add(s_str)
                    nodes.add(t_str)
                except (ValueError, TypeError):
                    continue
                    
        links = [{"source": s, "target": t, "value": v} for (s, t), v in flows.items()]
        
        return {
            "type": "sankey",
            "title": title,
            "data": {
                "nodes": [{"id": n} for n in sorted(list(nodes))],
                "links": links
            },
            "config": {
                "layout_iterations": 32,
                "node_width": 15,
                "node_padding": 10
            }
        }

    @staticmethod
    def create_radar_chart(
        data: List[Dict[str, Any]],
        category_column: str,
        metric_columns: List[str],
        title: str = "Radar Chart"
    ) -> Dict[str, Any]:
        """Create radar chart comparing metrics across categories"""
        chart_data = []
        
        for record in data:
            cat = record.get(category_column)
            if not cat:
                continue
                
            entry = {"category": str(cat)}
            for metric in metric_columns:
                val = record.get(metric)
                try:
                    entry[metric] = float(val) if val is not None else 0
                except (ValueError, TypeError):
                    entry[metric] = 0
            chart_data.append(entry)
            
        return {
            "type": "radar",
            "title": title,
            "data": chart_data,
            "config": {
                "metrics": metric_columns,
                "fill": True,
                "stroke_width": 2
            }
        }

    @staticmethod
    def create_funnel(
        data: List[Dict[str, Any]],
        stage_column: str,
        value_column: str,
        title: str = "Funnel Chart"
    ) -> Dict[str, Any]:
        """Create funnel chart data"""
        # Group by stage and sum values
        stages = {}
        for record in data:
            stage = record.get(stage_column)
            val = record.get(value_column)
            if stage and val is not None:
                try:
                    stages[str(stage)] = stages.get(str(stage), 0) + float(val)
                except (ValueError, TypeError):
                    continue
        
        # Convert to list and sort descending by value (typical funnel)
        chart_data = [{"stage": k, "value": v} for k, v in stages.items()]
        chart_data.sort(key=lambda x: x["value"], reverse=True)
        
        # Calculate conversion rates
        if chart_data:
            max_val = chart_data[0]["value"]
            for item in chart_data:
                item["percentage"] = round((item["value"] / max_val) * 100, 1)
                
        return {
            "type": "funnel",
            "title": title,
            "data": chart_data,
            "config": {
                "sort": "descending",
                "dynamic_height": True
            }
        }

    @staticmethod
    def create_map(
        data: List[Dict[str, Any]],
        location_column: str,
        value_column: str,
        lat_column: Optional[str] = None,
        lon_column: Optional[str] = None,
        title: str = "Map Visualization"
    ) -> Dict[str, Any]:
        """Create geospatial map data"""
        chart_data = []
        
        for record in data:
            entry = {
                "location": str(record.get(location_column)),
                "value": float(record.get(value_column, 0))
            }
            if lat_column and lon_column:
                try:
                    entry["lat"] = float(record.get(lat_column))
                    entry["lon"] = float(record.get(lon_column))
                except (ValueError, TypeError):
                    pass
            chart_data.append(entry)
            
        return {
            "type": "map",
            "title": title,
            "data": chart_data,
            "config": {
                "map_type": "world" if not lat_column else "markers",
                "color_scale": "sequential"
            }
        }
    
    @staticmethod
    def validate_visualization_config(
        config: Dict[str, Any],
        required_fields: List[str]
    ) -> bool:
        """Validate visualization configuration"""
        if not config:
            return False
        
        for field in required_fields:
            if field not in config:
                return False
        
        return True